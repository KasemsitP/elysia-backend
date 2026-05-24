import { bookletRepo } from "./booklets.repo";
import { campaignRepo } from "../campaign/campaign.repo";
import { sessionRepo } from "../session/session.repo";
import { AppError } from "../../cores/errors";
import { prisma } from "../../cores/prisma";
import { campaignKeyService } from "../campaign-keys/campaign-keys.service";
import { runBookletEncryptWorker } from "../../cores/booklet-runner";

const DB_BATCH_SIZE = 500;
import type { GenerateBookletsBody, UpdateBookletBody, BookletQuery } from "./booklets.type";

export const bookletService = {
    async findByCampaign(campaignId: number, query: BookletQuery) {
        const campaign = await campaignRepo.findById(campaignId);
        if (!campaign) throw new AppError("ไม่พบรอบสอบ", 404);
        const data = await bookletRepo.findByCampaign(campaignId, query.session_id, query.status);
        return { success: true, message: "ดึงข้อมูลเล่มข้อสอบสำเร็จ", data };
    },

    async findById(bookletId: number) {
        const data = await bookletRepo.findById(bookletId);
        if (!data) throw new AppError("ไม่พบเล่มข้อสอบ", 404);
        // ห้าม expose qr_payload (encrypted ciphertext)
        const { qr_payload: _, ...safeData } = data;
        return { success: true, message: "ดึงข้อมูลเล่มข้อสอบสำเร็จ", data: safeData };
    },

    async generate(campaignId: number, sessionId: number, input: GenerateBookletsBody) {
        const campaign = await campaignRepo.findById(campaignId);
        if (!campaign) throw new AppError("ไม่พบรอบสอบ", 404);

        const session = await sessionRepo.findById(sessionId, campaignId);
        if (!session) throw new AppError("ไม่พบวันสอบ", 404);

        // อ่าน MK จาก DB → ถอดรหัสด้วย MASTER_KEY → derive combinedKey
        const combinedKey = await campaignKeyService.getCombinedKey(campaignId);

        // ตรวจ user_codes ซ้ำก่อน generate
        const uniqueCodes = new Set(input.user_codes);
        if (uniqueCodes.size !== input.user_codes.length) {
            throw new AppError("พบ user_code ซ้ำกันใน request", 400);
        }

        // ตรวจว่า user_code ใดซ้ำกับที่มีอยู่แล้วใน session นี้
        const existingCodes = await prisma.booklets.findMany({
            where: { campaign_id: campaignId, session_id: sessionId, deleted_at: null, user_code: { in: input.user_codes } },
            select: { user_code: true },
        });
        if (existingCodes.length > 0) {
            const dup = existingCodes.map((b) => b.user_code).join(", ");
            throw new AppError(`user_code ซ้ำกับที่มีอยู่แล้ว: ${dup}`, 409);
        }

        try {
            // Encrypt ใน worker thread — ไม่บล็อก main event loop
            const records = await runBookletEncryptWorker(
                input.user_codes,
                combinedKey.toString("base64"),
                campaignId,
                sessionId,
            );

            // Batch insert 500 เล่มต่อครั้ง — ป้องกัน MySQL packet size limit
            await prisma.$transaction(async (tx) => {
                for (let i = 0; i < records.length; i += DB_BATCH_SIZE) {
                    await bookletRepo.createMany(records.slice(i, i + DB_BATCH_SIZE), tx);
                }
            });
        } finally {
            // ล้าง combinedKey จากหน่วยความจำ เสมอ (แม้จะ error)
            combinedKey.fill(0);
        }

        const count = await bookletRepo.countBySession(campaignId, sessionId);
        return {
            success: true,
            message: `สร้างเล่มข้อสอบสำเร็จ ${input.user_codes.length} เล่ม (รวมทั้งหมด ${count} เล่มใน session นี้)`,
            data: { generated: input.user_codes.length, total_in_session: count },
        };
    },

    async update(bookletId: number, input: UpdateBookletBody) {
        const booklet = await bookletRepo.findById(bookletId);
        if (!booklet) throw new AppError("ไม่พบเล่มข้อสอบ", 404);
        const data = await bookletRepo.update(bookletId, {
            ...(input.status !== undefined && { status: input.status }),
            ...(input.user_code !== undefined && { user_code: input.user_code }),
        });
        const { qr_payload: _, ...safeData } = data;
        return { success: true, message: "อัปเดตเล่มข้อสอบสำเร็จ", data: safeData };
    },

    async generateAll(campaignId: number) {
        const campaign = await campaignRepo.findById(campaignId);
        if (!campaign) throw new AppError("ไม่พบรอบสอบ", 404);

        const sessions = await prisma.sessions.findMany({
            where:   { campaign_id: campaignId, deleted_at: null },
            select:  { id: true },
            orderBy: { day_no: "asc" },
        });
        if (sessions.length === 0) throw new AppError("ไม่มีวันสอบในรอบสอบนี้", 400);

        const combinedKey = await campaignKeyService.getCombinedKey(campaignId);
        const combinedKeyBase64 = combinedKey.toString("base64");

        const summary: { session_id: number; generated: number; skipped: number }[] = [];
        let totalGenerated = 0;

        try {
            for (const session of sessions) {
                const rows = await prisma.$queryRaw<{ user_code: string }[]>`
                    SELECT u.user_code
                    FROM user_sessions us
                    INNER JOIN user_campaigns uc ON uc.id = us.user_campaign_id AND uc.deleted_at IS NULL
                    INNER JOIN users u ON u.id = uc.user_id AND u.deleted_at IS NULL
                    WHERE us.session_id = ${session.id}
                      AND us.campaign_id = ${campaignId}
                      AND us.deleted_at IS NULL
                `;
                const allCodes = rows.map((r) => r.user_code).filter(Boolean);

                if (allCodes.length === 0) {
                    summary.push({ session_id: session.id, generated: 0, skipped: 0 });
                    continue;
                }

                const existing = await prisma.booklets.findMany({
                    where:  { campaign_id: campaignId, session_id: session.id, deleted_at: null },
                    select: { user_code: true },
                });
                const existingSet = new Set(
                    existing.map((b) => b.user_code).filter((c): c is string => !!c),
                );
                const newCodes = allCodes.filter((c) => !existingSet.has(c));

                if (newCodes.length === 0) {
                    summary.push({ session_id: session.id, generated: 0, skipped: allCodes.length });
                    continue;
                }

                const records = await runBookletEncryptWorker(newCodes, combinedKeyBase64, campaignId, session.id);

                await prisma.$transaction(async (tx) => {
                    for (let i = 0; i < records.length; i += DB_BATCH_SIZE) {
                        await bookletRepo.createMany(records.slice(i, i + DB_BATCH_SIZE), tx);
                    }
                });

                summary.push({ session_id: session.id, generated: newCodes.length, skipped: existingSet.size });
                totalGenerated += newCodes.length;
            }
        } finally {
            combinedKey.fill(0);
        }

        await campaignRepo.setIsEncrypted(campaignId, true);

        return {
            success: true,
            message: `สร้างเล่มข้อสอบทั้งรอบสอบสำเร็จ สร้างทั้งหมด ${totalGenerated} เล่ม`,
            data: { total_generated: totalGenerated, sessions: summary },
        };
    },

    async delete(bookletId: number) {
        const booklet = await bookletRepo.findById(bookletId);
        if (!booklet) throw new AppError("ไม่พบเล่มข้อสอบ", 404);
        if (booklet.bag_id !== null) throw new AppError("ไม่สามารถลบเล่มที่อยู่ในถุงแล้วได้", 400);
        await bookletRepo.softDelete(bookletId);
        return { success: true, message: "ลบเล่มข้อสอบสำเร็จ" };
    },
};
