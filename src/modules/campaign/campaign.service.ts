import { campaignRepo } from "./campaign.repo";
import { AppError } from "../../cores/errors";
import type { CreateCampaignBody, UpdateCampaignBody, SetActiveBody, SetQrActiveBody } from "./campaign.type";

export const campaignService = {
    async findAll() {
        const data = await campaignRepo.findAll();
        return { success: true, message: "ดึงข้อมูลรอบสอบสำเร็จ", data };
    },

    async findById(campaignId: number) {
        const data = await campaignRepo.findById(campaignId);
        if (!data) throw new AppError("ไม่พบรอบสอบ", 404);
        return { success: true, message: "ดึงข้อมูลรอบสอบสำเร็จ", data };
    },

    async findByIdFull(campaignId: number) {
        const data = await campaignRepo.findByIdWithDetails(campaignId);
        if (!data) throw new AppError("ไม่พบรอบสอบ", 404);
        return { success: true, message: "ดึงข้อมูลรอบสอบสำเร็จ", data };
    },

    async create(input: CreateCampaignBody) {
        const dup = await campaignRepo.existsByYearAndSize(input.year_be, input.campaign_size);
        if (dup) throw new AppError(`รอบสอบปี ${input.year_be} ขนาด ${input.campaign_size} มีอยู่แล้ว`, 409);
        const data = await campaignRepo.create(input);
        return { success: true, message: "สร้างรอบสอบสำเร็จ", data };
    },

    async update(campaignId: number, input: UpdateCampaignBody) {
        const campaign = await campaignRepo.findById(campaignId);
        if (!campaign) throw new AppError("ไม่พบรอบสอบ", 404);
        if (input.year_be && input.campaign_size) {
            const dup = await campaignRepo.existsByYearAndSize(input.year_be, input.campaign_size, campaignId);
            if (dup) throw new AppError(`รอบสอบปี ${input.year_be} ขนาด ${input.campaign_size} มีอยู่แล้ว`, 409);
        }
        const data = await campaignRepo.update(campaignId, input);
        return { success: true, message: "อัปเดตรอบสอบสำเร็จ", data };
    },

    async setActive(campaignId: number, input: SetActiveBody) {
        const campaign = await campaignRepo.findById(campaignId);
        if (!campaign) throw new AppError("ไม่พบรอบสอบ", 404);
        const data = await campaignRepo.setActive(campaignId, input.is_active);
        return { success: true, message: `${input.is_active ? "เปิด" : "ปิด"}การใช้งานรอบสอบสำเร็จ`, data };
    },

    async setQrActive(campaignId: number, input: SetQrActiveBody) {
        const campaign = await campaignRepo.findById(campaignId);
        if (!campaign) throw new AppError("ไม่พบรอบสอบ", 404);
        const data = await campaignRepo.setQrActive(campaignId, input.qr_active);
        return { success: true, message: `${input.qr_active ? "เปิด" : "ปิด"}QR สำเร็จ`, data };
    },

    async delete(campaignId: number) {
        const campaign = await campaignRepo.findById(campaignId);
        if (!campaign) throw new AppError("ไม่พบรอบสอบ", 404);
        await campaignRepo.softDelete(campaignId);
        return { success: true, message: "ลบรอบสอบสำเร็จ" };
    },
};
