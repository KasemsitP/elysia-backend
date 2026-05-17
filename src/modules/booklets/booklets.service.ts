import { randomBytes } from "crypto";
import { bookletRepo } from "./booklets.repo";
import { campaignRepo } from "../campaign/campaign.repo";
import { sessionRepo } from "../session/session.repo";
import { AppError } from "../../cores/errors";
import { prisma } from "../../cores/prisma";
import type { GenerateBookletsBody, UpdateBookletBody, BookletQuery } from "./booklets.type";

export const bookletService = {
    async findByCampaign(campaignId: number, query: BookletQuery) {
        const campaign = await campaignRepo.findById(campaignId);
        if (!campaign) throw new AppError("ไม่พบรอบสอบ", 404);
        const data = await bookletRepo.findByCampaign(
            campaignId,
            query.session_id,
            query.status,
        );
        return { success: true, message: "ดึงข้อมูลเล่มข้อสอบสำเร็จ", data };
    },

    async findById(bookletId: number) {
        const data = await bookletRepo.findById(bookletId);
        if (!data) throw new AppError("ไม่พบเล่มข้อสอบ", 404);
        // ไม่ส่ง qr_payload กลับ — ให้ใช้แค่ตอน scan
        const { qr_payload: _, ...safeData } = data;
        return { success: true, message: "ดึงข้อมูลเล่มข้อสอบสำเร็จ", data: safeData };
    },

    // สร้างเล่มข้อสอบพร้อม qr_payload unique ต่อเล่ม
    // qr_payload จะถูกเก็บ opaque — ห้าม expose ออก response
    async generate(campaignId: number, sessionId: number, input: GenerateBookletsBody) {
        const campaign = await campaignRepo.findById(campaignId);
        if (!campaign) throw new AppError("ไม่พบรอบสอบ", 404);

        const session = await sessionRepo.findById(sessionId, campaignId);
        if (!session) throw new AppError("ไม่พบวันสอบ", 404);

        const records = Array.from({ length: input.count }, () => ({
            campaign_id: campaignId,
            session_id: sessionId,
            qr_payload: randomBytes(32).toString("hex"),
        }));

        await prisma.$transaction(async (tx) => {
            await bookletRepo.createMany(records, tx);
        });

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
