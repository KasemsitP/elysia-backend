import { bookletRepo } from "./booklets.repo";
import { campaignRepo } from "../campaign/campaign.repo";
import { sessionRepo } from "../session/session.repo";
import { AppError } from "../../cores/errors";
import { prisma } from "../../cores/prisma";
import { campaignKeyService } from "../campaign-keys/campaign-keys.service";
import { runBookletEncryptWorker } from "../../cores/booklet-runner";
import { signsheetService } from "../signsheet/signsheet.service";

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
        const { qr_payload: _, ...safeData } = data;
        return { success: true, message: "ดึงข้อมูลเล่มข้อสอบสำเร็จ", data: safeData };
    },

    async generate(campaignId: number, sessionId: number, input: GenerateBookletsBody) {
        const campaign = await campaignRepo.findById(campaignId);
        if (!campaign) throw new AppError("ไม่พบรอบสอบ", 404);

        const session = await sessionRepo.findById(sessionId, campaignId);
        if (!session) throw new AppError("ไม่พบวันสอบ", 404);

        const combinedKey = await campaignKeyService.getCombinedKey(campaignId);

        const uniqueCodes = new Set(input.user_codes);
        if (uniqueCodes.size !== input.user_codes.length) {
            throw new AppError("พบ user_code ซ้ำกันใน request", 400);
        }

        const existingCount = await bookletRepo.countBySession(campaignId, sessionId);
        if (existingCount > 0) {
            throw new AppError(`session นี้มี booklet อยู่แล้ว ${existingCount} เล่ม`, 409);
        }

        // qrMap สร้างระหว่าง encryption — user_code → qr_payload (ciphertext)
        const qrMap = new Map<string, string>();

        try {
            const records = await runBookletEncryptWorker(
                input.user_codes,
                combinedKey.toString("base64"),
                campaignId,
                sessionId,
                0, // generate ครั้งแรก เริ่ม 0001
            );

            // worker ส่งกลับมาในลำดับเดียวกับ input.user_codes
            input.user_codes.forEach((code, i) => {
                const payload = records[i]?.qr_payload;
                if (payload) qrMap.set(code, payload);
            });

            await prisma.$transaction(async (tx) => {
                for (let i = 0; i < records.length; i += DB_BATCH_SIZE) {
                    await bookletRepo.createMany(records.slice(i, i + DB_BATCH_SIZE), tx);
                }
            });
        } finally {
            combinedKey.fill(0); // zero key — qrMap เก็บแค่ ciphertext ไม่ต้องลบ
        }

        // สร้าง signsheet PDF ทันที ขณะที่ mapping ยังอยู่ใน memory ไม่ต้อง decrypt
        try {
            await signsheetService.generateAndStoreSignsheetPdf(campaignId, sessionId, qrMap);
        } catch (err) {
            console.error(`[booklets.generate] signsheet PDF ล้มเหลว (campaign=${campaignId} session=${sessionId}):`, err);
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

        // qrMaps เก็บ mapping ต่อ session เพื่อสร้าง PDF หลัง key.fill(0)
        // (Map ของ ciphertext ไม่มี key material — safe หลัง zero)
        const sessionQrMaps = new Map<number, Map<string, string>>();

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

                const existingCount = await bookletRepo.countBySession(campaignId, session.id);
                if (existingCount >= allCodes.length) {
                    summary.push({ session_id: session.id, generated: 0, skipped: allCodes.length });
                    continue;
                }

                const remaining = allCodes.slice(existingCount);
                const records = await runBookletEncryptWorker(
                    remaining, combinedKeyBase64, campaignId, session.id,
                    existingCount, // random_num ต่อจากเล่มที่มีอยู่แล้ว
                );

                // สร้าง qrMap เฉพาะกรณี generate ครบ session (ไม่มี existing booklets)
                // กรณี partial (existingCount > 0) ข้ามสร้าง PDF เพราะไม่มี mapping ของ existing
                if (existingCount === 0) {
                    const qrMap = new Map<string, string>();
                    allCodes.forEach((code, i) => {
                        const payload = records[i]?.qr_payload;
                        if (payload) qrMap.set(code, payload);
                    });
                    sessionQrMaps.set(session.id, qrMap);
                }

                await prisma.$transaction(async (tx) => {
                    for (let i = 0; i < records.length; i += DB_BATCH_SIZE) {
                        await bookletRepo.createMany(records.slice(i, i + DB_BATCH_SIZE), tx);
                    }
                });

                summary.push({ session_id: session.id, generated: remaining.length, skipped: existingCount });
                totalGenerated += remaining.length;
            }
        } finally {
            combinedKey.fill(0);
        }

        await campaignRepo.setIsEncrypted(campaignId, true);

        // สร้าง PDF ทุก session ที่ generate ครบ — หลัง key.fill(0) เพราะ qrMap ไม่มี key
        for (const [sessionId, qrMap] of sessionQrMaps) {
            try {
                await signsheetService.generateAndStoreSignsheetPdf(campaignId, sessionId, qrMap);
            } catch (err) {
                console.error(`[booklets.generateAll] signsheet PDF ล้มเหลว (campaign=${campaignId} session=${sessionId}):`, err);
            }
        }

        return {
            success: true,
            message: `สร้างเล่มข้อสอบทั้งรอบสอบสำเร็จ สร้างทั้งหมด ${totalGenerated} เล่ม`,
            data: { total_generated: totalGenerated, sessions: summary },
        };
    },

    /**
     * สร้าง QR payload ใหม่สำหรับ session ที่ key เปลี่ยน (qr_status = STALE)
     * และสร้าง signsheet PDF ใหม่ทันที — ไม่ต้อง decrypt
     */
    async regenerateSessionBooklets(campaignId: number, sessionId: number) {
        const campaign = await campaignRepo.findById(campaignId);
        if (!campaign) throw new AppError("ไม่พบรอบสอบ", 404);

        const session = await sessionRepo.findById(sessionId, campaignId);
        if (!session) throw new AppError("ไม่พบวันสอบ", 404);

        const bagsCount = await prisma.bags.count({
            where: { campaign_id: campaignId, session_id: sessionId, deleted_at: null },
        });
        if (bagsCount > 0) {
            throw new AppError(
                "ไม่สามารถสร้าง QR ใหม่ได้ — session นี้มีการแพ็คถุงข้อสอบแล้ว",
                409,
            );
        }

        const gradingCount = await prisma.grading_score_drafts.count({
            where: { campaign_id: campaignId, session_id: sessionId },
        });
        if (gradingCount > 0) {
            throw new AppError(
                "ไม่สามารถสร้าง QR ใหม่ได้ — session นี้มีข้อมูลการตรวจคำตอบแล้ว",
                409,
            );
        }

        const staleCount = await prisma.booklets.count({
            where: { campaign_id: campaignId, session_id: sessionId, qr_status: "STALE", deleted_at: null },
        });
        if (staleCount === 0) {
            throw new AppError("ไม่มีเล่มข้อสอบที่ต้องสร้างใหม่ (ไม่พบสถานะ STALE)", 400);
        }

        const combinedKey = await campaignKeyService.getCombinedKey(campaignId);
        const qrMap = new Map<string, string>();

        try {
            const rows = await prisma.$queryRaw<{ user_code: string }[]>`
                SELECT u.user_code
                FROM user_sessions us
                INNER JOIN user_campaigns uc ON uc.id = us.user_campaign_id AND uc.deleted_at IS NULL
                INNER JOIN users u ON u.id = uc.user_id AND u.deleted_at IS NULL
                WHERE us.session_id = ${sessionId}
                  AND us.campaign_id = ${campaignId}
                  AND us.deleted_at IS NULL
            `;
            const userCodes = rows.map((r) => r.user_code).filter(Boolean);

            if (userCodes.length === 0) {
                throw new AppError("ไม่มีรายชื่อผู้สอบใน session นี้", 400);
            }

            const records = await runBookletEncryptWorker(
                userCodes,
                combinedKey.toString("base64"),
                campaignId,
                sessionId,
                0, // regenerate จากศูนย์ (soft-delete เก่าทั้งหมดแล้ว) เริ่ม 0001
            );

            // สร้าง qrMap ขณะที่ mapping ยังอยู่ใน memory
            userCodes.forEach((code, i) => {
                const payload = records[i]?.qr_payload;
                if (payload) qrMap.set(code, payload);
            });

            await prisma.$transaction(async (tx) => {
                // Soft-delete booklets เก่าทั้งหมด
                await tx.booklets.updateMany({
                    where: { campaign_id: campaignId, session_id: sessionId, deleted_at: null },
                    data: { deleted_at: new Date() },
                });

                // Insert booklets ใหม่ (qr_status = 'READY' by DB default)
                for (let i = 0; i < records.length; i += DB_BATCH_SIZE) {
                    await bookletRepo.createMany(records.slice(i, i + DB_BATCH_SIZE), tx);
                }

                // Reset signsheet — PDF ใหม่จะถูกสร้างทันทีหลัง transaction
                await tx.sessions.updateMany({
                    where: { id: sessionId, campaign_id: campaignId },
                    data: { signsheet_status: "NOT_GENERATED", signsheet_file: null },
                });
            });
        } finally {
            combinedKey.fill(0);
        }

        // สร้าง PDF ทันที — qrMap มีแค่ ciphertext ไม่ต้อง key แล้ว
        try {
            await signsheetService.generateAndStoreSignsheetPdf(campaignId, sessionId, qrMap);
        } catch (err) {
            console.error(`[booklets.regenerate] signsheet PDF ล้มเหลว (campaign=${campaignId} session=${sessionId}):`, err);
        }

        const newCount = await bookletRepo.countBySession(campaignId, sessionId);
        return {
            success: true,
            message: `สร้าง QR payload ใหม่สำเร็จ ${newCount} เล่ม พร้อม PDF ใบรายชื่อ`,
            data: { session_id: sessionId, regenerated: newCount },
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
