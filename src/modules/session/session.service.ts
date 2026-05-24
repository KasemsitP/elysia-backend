import { sessionRepo } from "./session.repo";
import { campaignRepo } from "../campaign/campaign.repo";
import { AppError } from "../../cores/errors";
import { prisma } from "../../cores/prisma";
import type { CreateSessionBody, UpdateSessionBody } from "./session.type";

export const sessionService = {
    async findByCampaign(campaignId: number) {
        const campaign = await campaignRepo.findById(campaignId);
        if (!campaign) throw new AppError("ไม่พบรอบสอบ", 404);
        const sessions = await sessionRepo.findByCampaign(campaignId);
        const data = sessions.map(({ session_subjects, ...s }) => ({
            ...s,
            examSubjects: session_subjects
                .map((ss) => ss.campaign_subjects.name)
                .join("และ"),
        }));
        return { success: true, message: "ดึงข้อมูลวันสอบสำเร็จ", data };
    },

    async findById(campaignId: number, sessionId: number) {
        const data = await sessionRepo.findById(sessionId, campaignId);
        if (!data) throw new AppError("ไม่พบวันสอบ", 404);
        return { success: true, message: "ดึงข้อมูลวันสอบสำเร็จ", data };
    },

    async create(campaignId: number, input: CreateSessionBody) {
        const campaign = await campaignRepo.findById(campaignId);
        if (!campaign) throw new AppError("ไม่พบรอบสอบ", 404);

        const dupCode = await sessionRepo.existsByCode(campaignId, input.session_code);
        if (dupCode) throw new AppError(`รหัส ${input.session_code} มีอยู่แล้วในรอบสอบนี้`, 409);

        const dupDay = await sessionRepo.existsByDayNo(campaignId, input.day_no);
        if (dupDay) throw new AppError(`วันที่ ${input.day_no} มีอยู่แล้วในรอบสอบนี้`, 409);

        const data = await sessionRepo.create(campaignId, input);
        return { success: true, message: "สร้างวันสอบสำเร็จ", data };
    },

    async update(campaignId: number, sessionId: number, input: UpdateSessionBody) {
        const session = await sessionRepo.findById(sessionId, campaignId);
        if (!session) throw new AppError("ไม่พบวันสอบ", 404);

        if (input.session_code !== undefined) {
            const dup = await sessionRepo.existsByCode(campaignId, input.session_code, sessionId);
            if (dup) throw new AppError(`รหัส ${input.session_code} มีอยู่แล้วในรอบสอบนี้`, 409);
        }
        if (input.day_no !== undefined) {
            const dup = await sessionRepo.existsByDayNo(campaignId, input.day_no, sessionId);
            if (dup) throw new AppError(`วันที่ ${input.day_no} มีอยู่แล้วในรอบสอบนี้`, 409);
        }

        const data = await sessionRepo.update(sessionId, input);
        return { success: true, message: "อัปเดตวันสอบสำเร็จ", data };
    },

    async delete(campaignId: number, sessionId: number) {
        const session = await sessionRepo.findById(sessionId, campaignId);
        if (!session) throw new AppError("ไม่พบวันสอบ", 404);
        await prisma.$transaction(async (tx) => {
            await sessionRepo.softDelete(sessionId, tx);
        });
        return { success: true, message: "ลบวันสอบสำเร็จ" };
    },
};
