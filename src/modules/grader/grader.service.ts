import { graderRepo } from "./grader.repo";
import { campaignRepo } from "../campaign/campaign.repo";
import { AppError } from "../../cores/errors";
import { prisma } from "../../cores/prisma";
import type { CreateGraderBody, UpdateGraderBody } from "./grader.type";

export const graderService = {
    async findByCampaign(campaignId: number) {
        const campaign = await campaignRepo.findById(campaignId);
        if (!campaign) throw new AppError("ไม่พบรอบสอบ", 404);
        const data = await graderRepo.findByCampaign(campaignId);
        return { success: true, message: "ดึงข้อมูลผู้ตรวจสำเร็จ", data };
    },

    async findById(graderId: number) {
        const data = await graderRepo.findById(graderId);
        if (!data) throw new AppError("ไม่พบผู้ตรวจ", 404);
        return { success: true, message: "ดึงข้อมูลผู้ตรวจสำเร็จ", data };
    },

    // ผูก account ที่มีอยู่แล้วให้เป็น grader ในรอบสอบนี้
    async create(campaignId: number, input: CreateGraderBody) {
        const campaign = await campaignRepo.findById(campaignId);
        if (!campaign) throw new AppError("ไม่พบรอบสอบ", 404);

        const account = await prisma.accounts.findFirst({
            where: { id: input.account_id, active: true, deleted_at: null },
        });
        if (!account) throw new AppError("ไม่พบบัญชีผู้ใช้", 404);
        if (account.role_id !== 4) throw new AppError("บัญชีนี้ไม่ใช่ผู้ตรวจ (role_id ต้องเป็น 4)", 400);

        const dup = await graderRepo.findByAccountAndCampaign(input.account_id, campaignId);
        if (dup && !dup.deleted_at) throw new AppError("บัญชีนี้เป็นผู้ตรวจในรอบสอบนี้แล้ว", 409);

        const data = await graderRepo.create(input.account_id, campaignId);
        return { success: true, message: "เพิ่มผู้ตรวจสำเร็จ", data };
    },

    async update(graderId: number, input: UpdateGraderBody) {
        const grader = await graderRepo.findById(graderId);
        if (!grader) throw new AppError("ไม่พบผู้ตรวจ", 404);
        await graderRepo.update(graderId, input.active);
        return { success: true, message: "อัปเดตสถานะผู้ตรวจสำเร็จ" };
    },

    async delete(graderId: number) {
        const grader = await graderRepo.findById(graderId);
        if (!grader) throw new AppError("ไม่พบผู้ตรวจ", 404);
        await graderRepo.softDelete(graderId);
        return { success: true, message: "ลบผู้ตรวจสำเร็จ" };
    },
};
