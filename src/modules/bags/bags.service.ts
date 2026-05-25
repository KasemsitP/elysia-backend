import { createHash } from "crypto";
import { bagRepo } from "./bags.repo";
import { bookletRepo } from "../booklets/booklets.repo";
import { campaignRepo } from "../campaign/campaign.repo";
import { AppError } from "../../cores/errors";
import { prisma } from "../../cores/prisma";
import type { ScanPreviewBody, CreateBagBody, UpdateBagStatusBody } from "./bags.type";
import type { SessionData } from "../auth/auth.type";

// mask qr_payload ก่อน log — ห้าม log plaintext ตาม claude.md
function maskPayload(payload: string) {
    return payload.substring(0, 8) + "..." + payload.substring(payload.length - 4);
}

function hashPayload(payload: string) {
    return createHash("sha256").update(payload).digest("hex");
}

/**
 * Validate qr_payloads ด้วย DB lookup อย่างเดียว — ไม่ decrypt
 * session_id อ่านจาก booklet เอง ไม่ต้องส่งมาจาก client
 */
async function resolveBooklets(
    campaign_id: number,
    qr_payloads: string[],
) {
    const results = await Promise.all(
        qr_payloads.map(async (qrStr) => {
            const booklet = await bookletRepo.findByQrPayload(qrStr);
            if (!booklet) return { payload: qrStr, error: "ไม่พบเล่มข้อสอบ" };
            if (booklet.campaign_id !== campaign_id) return { payload: qrStr, error: "เล่มนี้ไม่อยู่ในรอบสอบนี้" };
            if (booklet.bag_id !== null) return { payload: qrStr, error: "เล่มนี้อยู่ในถุงแล้ว" };
            return { payload: qrStr, booklet };
        }),
    );

    const errors = results.filter((r) => "error" in r);
    const valid = results.filter((r) => "booklet" in r) as Array<{
        payload: string;
        booklet: NonNullable<Awaited<ReturnType<typeof bookletRepo.findByQrPayload>>>;
    }>;

    // ตรวจว่าทุกเล่มอยู่ session เดียวกัน
    const sessionIds = new Set(valid.map((v) => v.booklet.session_id));
    if (sessionIds.size > 1) {
        return {
            errors: [{ payload: "", error: "เล่มข้อสอบในถุงต้องอยู่วันสอบเดียวกันทั้งหมด" }],
            valid: [] as typeof valid,
            session_id: null,
        };
    }

    const session_id = valid.length > 0 ? valid[0]!.booklet.session_id : null;
    return { errors, valid, session_id };
}

export const bagService = {
    async findByCampaign(campaignId: number) {
        const campaign = await campaignRepo.findById(campaignId);
        if (!campaign) throw new AppError("ไม่พบรอบสอบ", 404);
        const data = await bagRepo.findByCampaign(campaignId);
        return { success: true, message: "ดึงข้อมูลถุงสำเร็จ", data };
    },

    async findByCampaignAndSession(campaignId: number, sessionId: number) {
        const data = await bagRepo.findByCampaignAndSession(campaignId, sessionId);
        return { success: true, message: "ดึงข้อมูลถุงสำเร็จ", data };
    },

    async findById(bagId: number) {
        const data = await bagRepo.findById(bagId);
        if (!data) throw new AppError("ไม่พบถุงข้อสอบ", 404);
        return { success: true, message: "ดึงข้อมูลถุงสำเร็จ", data };
    },

    async findBooklets(bagId: number) {
        const bag = await bagRepo.findById(bagId);
        if (!bag) throw new AppError("ไม่พบถุงข้อสอบ", 404);
        const data = await bagRepo.findBookletsInBag(bagId);
        return { success: true, message: "ดึงข้อมูลเล่มในถุงสำเร็จ", data };
    },

    async findSummary(bagId: number) {
        const bag = await bagRepo.findById(bagId);
        if (!bag) throw new AppError("ไม่พบถุงข้อสอบ", 404);
        const booklets = await bagRepo.findBookletsInBag(bagId);
        const totalBooklets = booklets.length;
        const gradedSlots = await prisma.grading_slots.count({
            where: { booklets: { bag_id: bagId }, status: "COMPLETED" },
        });
        return {
            success: true,
            message: "ดึงข้อมูลสรุปถุงสำเร็จ",
            data: {
                bag,
                total_booklets: totalBooklets,
                completed_slots: gradedSlots,
            },
        };
    },

    // ตรวจสอบว่า qr_payloads ทั้งหมด valid ก่อนสร้างถุง — ไม่ทำ side effect ใดๆ
    async scanPreview(input: ScanPreviewBody) {
        const { errors, valid, session_id } = await resolveBooklets(
            input.campaign_id,
            input.qr_payloads,
        );

        // ดึงข้อมูล session + วิชา + เลขถุงถัดไป เฉพาะเมื่อ valid ทั้งหมด
        let confirm: {
            session_code: string;
            exam_date: string;
            exam_subjects: string;
            next_bag_no: number;
            booklet_count: number;
        } | null = null;

        if (errors.length === 0 && session_id) {
            const [session, sessionSubjects, next_bag_no] = await Promise.all([
                prisma.sessions.findFirst({
                    where:  { id: session_id, deleted_at: null },
                    select: { session_code: true, exam_date: true },
                }),
                prisma.session_subjects.findMany({
                    where:   { session_id, deleted_at: null },
                    include: { campaign_subjects: { select: { name: true } } },
                    orderBy: { order_no: "asc" },
                }),
                bagRepo.getNextBagNo(session_id),
            ]);

            confirm = {
                session_code:  session?.session_code ?? "-",
                exam_date:     session?.exam_date.toISOString().slice(0, 10) ?? "-",
                exam_subjects: sessionSubjects.map((ss) => ss.campaign_subjects.name).join("และ") || "-",
                next_bag_no,
                booklet_count: valid.length,
            };
        }

        return {
            success: true,
            message: errors.length === 0 ? "ตรวจสอบสำเร็จ พร้อมยืนยันสร้างถุง" : "พบข้อผิดพลาดบางรายการ",
            data: {
                valid_count:  valid.length,
                error_count:  errors.length,
                session_id,
                confirm,
                errors: errors.map((e) => ({ masked_payload: maskPayload(e.payload), reason: e.error })),
            },
        };
    },

    // สร้างถุงจาก qr_payloads พร้อม SELECT FOR UPDATE เพื่อกัน concurrent
    async create(input: CreateBagBody, session: SessionData) {
        const { errors, valid, session_id } = await resolveBooklets(
            input.campaign_id,
            input.qr_payloads,
        );

        if (errors.length > 0) {
            throw new AppError(
                `ข้อมูลไม่ถูกต้อง ${errors.length} รายการ: ${errors.map((e) => e.error).join(", ")}`,
                400,
            );
        }

        if (valid.length === 0) throw new AppError("ไม่มีเล่มที่สามารถลงถุงได้", 400);
        if (!session_id) throw new AppError("ไม่สามารถระบุวันสอบจากเล่มข้อสอบได้", 500);

        const result = await prisma.$transaction(async (tx) => {
            // 1. Ensure session_counters row exists ก่อน FOR UPDATE
            await bagRepo.upsertCounter(session_id, tx);

            // 2. Lock row ด้วย SELECT FOR UPDATE — ป้องกัน race condition
            const counter = await bagRepo.lockAndGetCounter(session_id, tx);
            if (!counter) throw new AppError("ไม่พบ session counter", 500);

            // 3. หาเลขถุงถัดไป — เติม gap ถ้ามี (เช่น ลบถุง 2 ไป → ได้ 2 คืน)
            const bag_no = await bagRepo.getNextBagNo(session_id, tx);

            // 4. สร้าง bag
            const bag = await bagRepo.create(
                {
                    campaign_id: input.campaign_id,
                    session_id: session_id,
                    bag_no,
                    count_items: valid.length,
                    created_by_account_id: session.account_id,
                },
                tx,
            );

            // 4. อัปเดต booklets: bag_id, seq_in_bag, random_num, status
            let seqIdx = 0;
            for (const v of valid) {
                await tx.booklets.update({
                    where: { id: v.booklet.id },
                    data: {
                        bag_id: bag.id,
                        seq_in_bag: seqIdx + 1,
                        random_num: String(counter.next_random_seq + seqIdx),
                        status: "PACKAGED",
                    },
                });
                seqIdx++;
            }

            // 5. บันทึก qr_scan_logs — ห้าม log plaintext payload
            await tx.qr_scan_logs.createMany({
                data: valid.map((v) => ({
                    campaign_id: input.campaign_id,
                    session_id: session_id,
                    bag_id: bag.id,
                    booklet_id: v.booklet.id,
                    scanned_by_account_id: session.account_id,
                    scan_context: "BAG_PACKAGING",
                    scan_result: "SUCCESS",
                    qr_payload_masked: maskPayload(v.payload),
                    qr_payload_hash: hashPayload(v.payload),
                })),
            });

            // 6. Increment random_num counter
            await bagRepo.incrementCounter(session_id, valid.length, tx);

            return bag;
        });

        return { success: true, message: `สร้างถุง #${result.bag_no} สำเร็จ (${valid.length} เล่ม)`, data: result };
    },

    async updateStatus(bagId: number, input: UpdateBagStatusBody) {
        const bag = await bagRepo.findById(bagId);
        if (!bag) throw new AppError("ไม่พบถุงข้อสอบ", 404);
        const data = await bagRepo.updateStatus(bagId, input.status);
        return { success: true, message: "อัปเดตสถานะถุงสำเร็จ", data };
    },

    async delete(bagId: number) {
        const bag = await bagRepo.findById(bagId);
        if (!bag) throw new AppError("ไม่พบถุงข้อสอบ", 404);
        if (bag.status !== "CREATED") throw new AppError("ลบได้เฉพาะถุงที่ยังไม่เริ่มตรวจ (status: CREATED)", 400);

        // ถ้ามี grading_slots แล้ว → ห้ามลบ เปลี่ยนเป็น VOID แทน
        const hasGrading = await prisma.grading_slots.count({
            where: { booklets: { bag_id: bagId }, deleted_at: null },
        });
        if (hasGrading > 0) {
            throw new AppError("ถุงนี้มีการตรวจแล้ว ไม่สามารถลบได้ ใช้ PATCH /bags/:bagId/status เปลี่ยนเป็น VOID แทน", 400);
        }
        await prisma.$transaction(async (tx) => {
            // คืนสถานะ booklets กลับเป็น PRINTED
            await tx.booklets.updateMany({
                where: { bag_id: bagId },
                data: { bag_id: null, seq_in_bag: null, random_num: null, status: "PRINTED" },
            });
            await bagRepo.softDelete(bagId, tx);
        });
        return { success: true, message: "ลบถุงข้อสอบสำเร็จ" };
    },
};
