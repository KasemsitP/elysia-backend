import { AppError } from "../../cores/errors";
import { prisma } from "../../cores/prisma";
import { runSignsheetPdfWorker } from "./signsheet-pdf.runner";
import type { signsheetQuerySchema } from "./signsheet.schema";
import type { Static } from "elysia";
import type { SignsheetRow, SignsheetPdfResult } from "./signsheet.type";

type SignsheetQuery = Static<typeof signsheetQuerySchema>;

// ── Date/time helpers ─────────────────────────────────────────────────────────

const THAI_MONTHS = [
    "มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน",
    "กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม",
] as const;

function formatThaiDate(date: Date): string {
    const day   = date.getUTCDate();
    const month = THAI_MONTHS[date.getUTCMonth()];
    const year  = date.getUTCFullYear() + 543;
    return `${day} ${month} พ.ศ. ${year}`;
}

function formatThaiTime(date: Date): string {
    const h = date.getHours().toString().padStart(2, "0");
    const m = date.getMinutes().toString().padStart(2, "0");
    return `${h}.${m}`;
}

function buildSessionText(
    session: { exam_date: Date },
    startAt: Date | null,
    endAt:   Date | null,
): string {
    const datePart = `วันที่ ${formatThaiDate(session.exam_date)}`;
    if (!startAt || !endAt) return datePart;
    return `${datePart} เวลา ${formatThaiTime(startAt)} - ${formatThaiTime(endAt)} น.`;
}

// ── Public service ────────────────────────────────────────────────────────────

export const signsheetService = {
    async getSignsheet(campaignId: number, sessionId: number, query: SignsheetQuery) {
        const page   = Math.max(1, Number(query.page  ?? 1));
        const limit  = Math.min(Math.max(1, Number(query.limit ?? 30)), 200);
        const search = (query.search ?? "").trim();

        const campaign = await prisma.exam_campaigns.findFirst({
            where:  { id: campaignId, deleted_at: null },
            select: { id: true, name: true, year_be: true, campaign_size: true, site: true, is_unlock: true },
        });
        if (!campaign) throw new AppError("ไม่พบรอบสอบ", 404);

        const session = await prisma.sessions.findFirst({
            where:  { id: sessionId, campaign_id: campaignId, deleted_at: null },
            select: { id: true, session_code: true, title: true, exam_date: true, day_no: true, signsheet_status: true },
        });
        if (!session) throw new AppError("ไม่พบวันสอบในรอบสอบนี้", 404);

        const searchFilter = search
            ? {
                users: {
                    OR: [
                        { full_name:  { contains: search } },
                        { user_code:  { contains: search } },
                        { first_name: { contains: search } },
                        { last_name:  { contains: search } },
                    ],
                },
              }
            : {};

        const where = {
            campaign_id: campaignId,
            deleted_at:  null,
            user_sessions_user_sessions_user_campaign_id_campaign_idTouser_campaigns: {
                some: { session_id: sessionId, campaign_id: campaignId, deleted_at: null },
            },
            ...searchFilter,
        };

        const [total, uc] = await Promise.all([
            prisma.user_campaigns.count({ where }),
            prisma.user_campaigns.findMany({
                where,
                select: {
                    id:        true,
                    room_code: true,
                    row_no:    true,
                    col_no:    true,
                    users:     {
                        select: {
                            id:          true,
                            user_code:   true,
                            title:       true,
                            full_name:   true,
                            first_name:  true,
                            last_name:   true,
                            national_id: true,
                        },
                    },
                },
                orderBy: [
                    { room_code: "asc" },
                    { row_no:    "asc" },
                    { col_no:    "asc" },
                    { users:     { user_code: "asc" } },
                ],
                skip: (page - 1) * limit,
                take: limit,
            }),
        ]);

        const offset = (page - 1) * limit;

        return {
            success: true,
            data: {
                campaign: {
                    id:            campaign.id,
                    name:          campaign.name,
                    year_be:       campaign.year_be,
                    campaign_size: campaign.campaign_size,
                    site:          campaign.site,
                    is_unlock:     campaign.is_unlock,
                },
                session: {
                    id:               session.id,
                    session_code:     session.session_code,
                    title:            session.title,
                    exam_date:        session.exam_date.toISOString().slice(0, 10),
                    day_no:           session.day_no,
                    signsheet_status: session.signsheet_status,
                },
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit),
                },
                rows: uc.map((row, idx) => ({
                    index:      offset + idx + 1,
                    userId:     row.users?.id     ?? null,
                    userCode:   row.users?.user_code  ?? null,
                    title:      row.users?.title      ?? null,
                    fullName:   row.users?.full_name  ?? null,
                    firstName:  row.users?.first_name ?? null,
                    lastName:   row.users?.last_name  ?? null,
                    nationalId: row.users?.national_id ?? null,
                    roomCode:   row.room_code,
                    rowNo:      row.row_no,
                    colNo:      row.col_no,
                    seatNo:     row.row_no != null && row.col_no != null
                        ? `${row.row_no}/${row.col_no}`
                        : null,
                })),
            },
        };
    },

    /** สถานะ PDF ของ session (NOT_GENERATED / READY / STALE) */
    async getSignsheetPdfStatus(campaignId: number, sessionId: number) {
        const session = await prisma.sessions.findFirst({
            where:  { id: sessionId, campaign_id: campaignId, deleted_at: null },
            select: { signsheet_status: true, signsheet_file: true },
        });
        if (!session) throw new AppError("ไม่พบวันสอบ", 404);

        const staleBooklets = await prisma.booklets.count({
            where: { campaign_id: campaignId, session_id: sessionId, qr_status: "STALE", deleted_at: null },
        });

        return {
            success: true,
            data: {
                signsheet_status: session.signsheet_status,
                has_file:         !!session.signsheet_file,
                stale_booklets:   staleBooklets,
                can_generate:     staleBooklets === 0,
            },
        };
    },

    /**
     * ดาวน์โหลด PDF ที่บันทึกไว้ — ไม่มีการ decrypt เลย
     *
     * - NOT_GENERATED → ยังไม่มีไฟล์ (booklet ยังไม่ถูก generate)
     * - STALE         → key เปลี่ยน ห้าม serve ไฟล์เก่า
     * - READY         → คืน path ไฟล์ที่เก็บไว้
     */
    async getStoredSignsheetPdfPath(campaignId: number, sessionId: number): Promise<string> {
        const session = await prisma.sessions.findFirst({
            where:  { id: sessionId, campaign_id: campaignId, deleted_at: null },
            select: { signsheet_status: true, signsheet_file: true },
        });
        if (!session) throw new AppError("ไม่พบวันสอบ", 404);

        if (session.signsheet_status === "NOT_GENERATED" || !session.signsheet_file) {
            throw new AppError(
                "ยังไม่มีไฟล์ PDF — กรุณาสร้าง QR Payload ก่อน",
                404,
            );
        }
        if (session.signsheet_status === "STALE") {
            throw new AppError(
                "PDF ล้าสมัย — มีการเปลี่ยน Manager Key กรุณาสร้าง QR ใหม่แล้วระบบจะสร้าง PDF ให้อัตโนมัติ",
                422,
            );
        }

        return session.signsheet_file;
    },

    /**
     * สร้าง signsheet PDF และบันทึก path ลง sessions
     *
     * รับ qrMap ที่ build มาแล้วจากขั้นตอน generate booklets
     * ไม่มีการ decrypt, ไม่ต้องการ manager key
     *
     * qrMap: user_code → qr_payload (ciphertext ที่จะพิมพ์เป็น QR code ใน PDF)
     */
    async generateAndStoreSignsheetPdf(
        campaignId: number,
        sessionId:  number,
        qrMap:      Map<string, string>,
    ): Promise<SignsheetPdfResult> {
        const [campaign, session, uc, sessionSubjectsData] = await Promise.all([
            prisma.exam_campaigns.findFirst({
                where:  { id: campaignId, deleted_at: null },
                select: { id: true, name: true, year_be: true, campaign_size: true, site: true, is_unlock: true },
            }),
            prisma.sessions.findFirst({
                where:  { id: sessionId, campaign_id: campaignId, deleted_at: null },
                select: { id: true, session_code: true, title: true, exam_date: true, day_no: true },
            }),
            prisma.user_campaigns.findMany({
                where: {
                    campaign_id: campaignId,
                    deleted_at:  null,
                    user_sessions_user_sessions_user_campaign_id_campaign_idTouser_campaigns: {
                        some: { session_id: sessionId, campaign_id: campaignId, deleted_at: null },
                    },
                },
                select: {
                    room_code: true,
                    row_no:    true,
                    col_no:    true,
                    users: {
                        select: {
                            id:          true,
                            user_code:   true,
                            title:       true,
                            full_name:   true,
                            first_name:  true,
                            last_name:   true,
                            national_id: true,
                        },
                    },
                },
                orderBy: [
                    { row_no:    "asc" },
                    { col_no:    "asc" },
                    { room_code: "asc" },
                    { users:     { user_code: "asc" } },
                ],
            }),
            prisma.session_subjects.findMany({
                where:   { session_id: sessionId, campaign_id: campaignId, deleted_at: null },
                include: { campaign_subjects: { select: { name: true } } },
                orderBy: { order_no: "asc" },
            }),
        ]);

        if (!campaign) throw new AppError("ไม่พบรอบสอบ", 404);
        if (!session)  throw new AppError("ไม่พบวันสอบ", 404);

        // Build rows — qrPayload มาจาก qrMap ที่ build ระหว่าง encrypt ไม่ต้อง decrypt
        const rows: SignsheetRow[] = uc.map((row, idx) => {
            const userCode = row.users?.user_code ?? null;
            return {
                index:      idx + 1,
                userId:     row.users?.id          ?? null,
                userCode,
                title:      row.users?.title       ?? null,
                fullName:   row.users?.full_name   ?? null,
                firstName:  row.users?.first_name  ?? null,
                lastName:   row.users?.last_name   ?? null,
                nationalId: row.users?.national_id ?? null,
                roomCode:   row.room_code,
                rowNo:      row.row_no,
                colNo:      row.col_no,
                seatNo:     row.row_no != null && row.col_no != null
                    ? `${row.row_no}/${row.col_no}`
                    : null,
                qrPayload:  userCode ? (qrMap.get(userCode) ?? null) : null,
            };
        });

        const examSubjects = sessionSubjectsData.map((ss) => ss.campaign_subjects.name).join("และ");

        const startAt = sessionSubjectsData.length > 0
            ? sessionSubjectsData.reduce((min, ss) => ss.start_at < min ? ss.start_at : min, sessionSubjectsData[0]!.start_at)
            : null;
        const endAt   = sessionSubjectsData.length > 0
            ? sessionSubjectsData.reduce((max, ss) => ss.end_at > max ? ss.end_at : max, sessionSubjectsData[0]!.end_at)
            : null;

        const campaignLabel = `${campaign.campaign_size} ${campaign.year_be}`;
        const sessionText   = buildSessionText(session, startAt, endAt);

        const result = await runSignsheetPdfWorker({
            campaign: {
                id:            campaign.id,
                name:          campaign.name,
                year_be:       campaign.year_be,
                campaign_size: campaign.campaign_size,
                site:          campaign.site,
                is_unlock:     campaign.is_unlock,
            },
            session: {
                id:           session.id,
                session_code: session.session_code,
                title:        session.title,
                exam_date:    session.exam_date.toISOString().slice(0, 10),
                day_no:       session.day_no,
            },
            rows,
            totalCount: rows.length,
            examSubjects,
            campaignLabel,
            sessionText,
        });

        // บันทึก path และ mark READY
        await prisma.sessions.updateMany({
            where: { id: sessionId, campaign_id: campaignId },
            data: {
                signsheet_file:   result.filePath,
                signsheet_status: "READY",
            },
        });

        return result;
    },
};
