import { randomBytes } from "crypto";
import { bookletRepo } from "./booklets.repo";
import { campaignRepo } from "../campaign/campaign.repo";
import { sessionRepo } from "../session/session.repo";
import { AppError } from "../../cores/errors";
import { prisma } from "../../cores/prisma";
import { encryptQrPayload } from "../../cores/qr-crypto";
import { campaignKeyService } from "../campaign-keys/campaign-keys.service";
import { DEK_RECORD_ORDER } from "../../cores/kek-crypto";
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

    /**
     * Generate booklets ด้วย QR payload ที่ encrypted ด้วย DEK
     *
     * ต้องให้ Manager Key 1 + Key 2 เพื่อ:
     * 1. Verify ทั้งคู่ (PBKDF2)
     * 2. Derive KEK = HKDF(MK1 ‖ MK2, campaignId)
     * 3. Unwrap DEK = AES-256-GCM-decrypt(KEK, encrypted_DEK)
     * 4. Encrypt QR payloads ด้วย DEK (AES-128-GCM)
     * 5. ล้าง DEK จากหน่วยความจำ
     *
     * DEK ไม่เคยออกนอก server request นี้
     */
    async generate(campaignId: number, sessionId: number, input: GenerateBookletsBody) {
        const campaign = await campaignRepo.findById(campaignId);
        if (!campaign) throw new AppError("ไม่พบรอบสอบ", 404);

        const session = await sessionRepo.findById(sessionId, campaignId);
        if (!session) throw new AppError("ไม่พบวันสอบ", 404);

        // ดึง DEK โดย verify manager keys และ unwrap ด้วย KEK
        // ถ้า key ผิด → throw 401 ก่อนถึง generate
        const dek = await campaignKeyService.getDecryptedDEK(
            campaignId,
            input.manager1_key,
            input.manager2_key,
        );

        // ดึง DEK record เพื่อรู้ order_num (kid ใน QR envelope)
        const dekRecord = await prisma.campaign_keys.findFirst({
            where: { campaign_id: campaignId, order_num: DEK_RECORD_ORDER, active: true },
        });

        try {
            // สร้าง encrypted QR payload ต่อเล่ม
            const records = Array.from({ length: input.count }, () => {
                const nonce = randomBytes(8).toString("hex"); // unique per booklet
                const qr_payload = encryptQrPayload(
                    { cid: campaignId, sid: sessionId, nonce },
                    dek.toString("base64"),      // DEK เป็น base64 สำหรับ qr-crypto
                    dekRecord?.order_num ?? DEK_RECORD_ORDER,
                );
                return { campaign_id: campaignId, session_id: sessionId, qr_payload };
            });

            await prisma.$transaction(async (tx) => {
                await bookletRepo.createMany(records, tx);
            });
        } finally {
            // ล้าง DEK จากหน่วยความจำ เสมอ (แม้จะ error)
            dek.fill(0);
        }

        const count = await bookletRepo.countBySession(campaignId, sessionId);
        return {
            success: true,
            message: `สร้างเล่มข้อสอบสำเร็จ ${input.count} เล่ม (รวมทั้งหมด ${count} เล่มใน session นี้)`,
            data: { generated: input.count, total_in_session: count },
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

    async delete(bookletId: number) {
        const booklet = await bookletRepo.findById(bookletId);
        if (!booklet) throw new AppError("ไม่พบเล่มข้อสอบ", 404);
        if (booklet.bag_id !== null) throw new AppError("ไม่สามารถลบเล่มที่อยู่ในถุงแล้วได้", 400);
        await bookletRepo.softDelete(bookletId);
        return { success: true, message: "ลบเล่มข้อสอบสำเร็จ" };
    },
};
