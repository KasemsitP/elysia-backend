import { campaignSubjectRepo } from "./campaign-subjects.repo";
import { campaignRepo } from "../campaign/campaign.repo";
import { AppError } from "../../cores/errors";
import { prisma } from "../../cores/prisma";
import type { CreateCampaignSubjectBody, UpdateCampaignSubjectBody } from "./campaign-subjects.type";

export const campaignSubjectService = {
    async findByCampaign(campaignId: number) {
        const campaign = await campaignRepo.findById(campaignId);
        if (!campaign) throw new AppError("ไม่พบรอบสอบ", 404);
        const data = await campaignSubjectRepo.findByCampaign(campaignId);
        return { success: true, message: "ดึงข้อมูลวิชาในรอบสอบสำเร็จ", data };
    },

    async create(campaignId: number, input: CreateCampaignSubjectBody) {
        const campaign = await campaignRepo.findById(campaignId);
        if (!campaign) throw new AppError("ไม่พบรอบสอบ", 404);

        const subject = await prisma.subjects.findFirst({
            where: { id: input.subject_id, active: true, deleted_at: null },
        });
        if (!subject) throw new AppError("ไม่พบวิชานี้ในระบบ", 404);

        const dupSubject = await campaignSubjectRepo.existsBySubjectId(campaignId, input.subject_id);
        if (dupSubject) throw new AppError("วิชานี้ถูกเพิ่มในรอบสอบนี้แล้ว", 409);

        const dupCode = await campaignSubjectRepo.existsByCode(campaignId, input.code);
        if (dupCode) throw new AppError(`รหัสวิชา ${input.code} ถูกใช้งานแล้วในรอบสอบนี้`, 409);

        const dupOrder = await campaignSubjectRepo.existsByOrderNo(campaignId, input.order_no);
        if (dupOrder) throw new AppError(`ลำดับที่ ${input.order_no} ถูกใช้งานแล้วในรอบสอบนี้`, 409);

        const data = await campaignSubjectRepo.create(campaignId, input);
        return { success: true, message: "เพิ่มวิชาในรอบสอบสำเร็จ", data };
    },

    async update(campaignId: number, campaignSubjectId: number, input: UpdateCampaignSubjectBody) {
        const cs = await campaignSubjectRepo.findById(campaignSubjectId, campaignId);
        if (!cs) throw new AppError("ไม่พบวิชานี้ในรอบสอบ", 404);

        if (input.code !== undefined) {
            const dup = await campaignSubjectRepo.existsByCode(campaignId, input.code, campaignSubjectId);
            if (dup) throw new AppError(`รหัสวิชา ${input.code} ถูกใช้งานแล้วในรอบสอบนี้`, 409);
        }
        if (input.order_no !== undefined) {
            const dup = await campaignSubjectRepo.existsByOrderNo(campaignId, input.order_no, campaignSubjectId);
            if (dup) throw new AppError(`ลำดับที่ ${input.order_no} ถูกใช้งานแล้วในรอบสอบนี้`, 409);
        }

        const data = await campaignSubjectRepo.update(campaignSubjectId, input);
        return { success: true, message: "อัปเดตวิชาในรอบสอบสำเร็จ", data };
    },

    async delete(campaignId: number, campaignSubjectId: number) {
        const cs = await campaignSubjectRepo.findById(campaignSubjectId, campaignId);
        if (!cs) throw new AppError("ไม่พบวิชานี้ในรอบสอบ", 404);
        await campaignSubjectRepo.softDelete(campaignSubjectId);
        return { success: true, message: "ลบวิชาออกจากรอบสอบสำเร็จ" };
    },
};
