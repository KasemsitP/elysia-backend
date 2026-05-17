import { sessionSubjectRepo } from "./session-subjects.repo";
import { sessionRepo } from "../session/session.repo";
import { campaignSubjectRepo } from "../campaign-subjects/campaign-subjects.repo";
import { AppError } from "../../cores/errors";
import { prisma } from "../../cores/prisma";
import type { CreateSessionSubjectBody, UpdateSessionSubjectBody } from "./session-subjects.type";

export const sessionSubjectService = {
    async findBySession(campaignId: number, sessionId: number) {
        const session = await sessionRepo.findById(sessionId, campaignId);
        if (!session) throw new AppError("ไม่พบวันสอบ", 404);
        const data = await sessionSubjectRepo.findBySession(campaignId, sessionId);
        return { success: true, message: "ดึงข้อมูลวิชาในวันสอบสำเร็จ", data };
    },

    async create(campaignId: number, sessionId: number, input: CreateSessionSubjectBody) {
        const session = await sessionRepo.findById(sessionId, campaignId);
        if (!session) throw new AppError("ไม่พบวันสอบ", 404);

        const cs = await campaignSubjectRepo.findById(input.campaign_subject_id, campaignId);
        if (!cs) throw new AppError("ไม่พบวิชานี้ในรอบสอบ", 404);

        const dupCs = await sessionSubjectRepo.existsByCampaignSubject(sessionId, input.campaign_subject_id);
        if (dupCs) throw new AppError("วิชานี้ถูกเพิ่มในวันสอบนี้แล้ว", 409);

        const dupOrder = await sessionSubjectRepo.existsByOrderNo(sessionId, input.order_no);
        if (dupOrder) throw new AppError(`ลำดับที่ ${input.order_no} ถูกใช้งานแล้วในวันสอบนี้`, 409);

        const data = await sessionSubjectRepo.create(campaignId, sessionId, input);
        return { success: true, message: "เพิ่มวิชาในวันสอบสำเร็จ", data };
    },

    async update(campaignId: number, sessionId: number, sessionSubjectId: number, input: UpdateSessionSubjectBody) {
        const ss = await sessionSubjectRepo.findById(sessionSubjectId, sessionId, campaignId);
        if (!ss) throw new AppError("ไม่พบวิชานี้ในวันสอบ", 404);

        if (input.order_no !== undefined) {
            const dup = await sessionSubjectRepo.existsByOrderNo(sessionId, input.order_no, sessionSubjectId);
            if (dup) throw new AppError(`ลำดับที่ ${input.order_no} ถูกใช้งานแล้วในวันสอบนี้`, 409);
        }

        const data = await sessionSubjectRepo.update(sessionSubjectId, input);
        return { success: true, message: "อัปเดตวิชาในวันสอบสำเร็จ", data };
    },

    async delete(campaignId: number, sessionId: number, sessionSubjectId: number) {
        const ss = await sessionSubjectRepo.findById(sessionSubjectId, sessionId, campaignId);
        if (!ss) throw new AppError("ไม่พบวิชานี้ในวันสอบ", 404);
        await prisma.$transaction(async (tx) => {
            await sessionSubjectRepo.softDelete(sessionSubjectId, tx);
        });
        return { success: true, message: "ลบวิชาออกจากวันสอบสำเร็จ" };
    },
};
