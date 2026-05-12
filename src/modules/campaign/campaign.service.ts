import { campaignRepo } from "./campaign.repo";
import { AppError } from "../../cores/errors";

export const campaignService = {

    async findAllCampaignWithSessionsAndSubjects() {
        const data = await campaignRepo.findAllCampaignWithSessionsAndSubjects();
        return { success: true, data };
    },

    async findCampaignWithSessionsAndSubjects(campaign_id: number) {
        const data = await campaignRepo.findCampaignWithSessionsAndSubjects(campaign_id);
        if (!data) throw new AppError("ไม่พบรอบสอบ", 404);
        return { success: true, data };
    },

    async updateCampaign(campaign_id: number, data: {
        year_be: string;
        site: string;
        campaign_size: string;
    }) {
        const campaign = await campaignRepo.findCampaignById(campaign_id);
        if (!campaign) throw new AppError("ไม่พบรอบสอบ", 404);
        const updated = await campaignRepo.updateCampaign(campaign_id, data);
        return { success: true, data: updated };
    },

    async updateCampaignIsActive(campaign_id: number, is_active: boolean) {
        const campaign = await campaignRepo.findCampaignById(campaign_id);
        if (!campaign) throw new AppError("ไม่พบรอบสอบ", 404);
        const updated = await campaignRepo.updateCampaignIsActive(campaign_id, is_active);
        return { success: true, data: updated };
    },

    async createCampaign(data: {
        name: string,
        code: string,
        is_active: boolean,
        year_be: string,
        site: string,
        is_unlock: boolean,
        campaign_size: string,
        qr_active: number,
    }) {
        const created = await campaignRepo.createCampaign(data);
        return { success: true, data: created };
    },

    async findQrActive(campaign_id: number) {
        const campaign = await campaignRepo.findCampaignById(campaign_id);
        if (!campaign) throw new AppError("ไม่พบรอบสอบ", 404);
        return { success: true, data: campaign.qr_active };
    },

    async updateQrActive(campaign_id: number) {
        const campaign = await campaignRepo.findCampaignById(campaign_id);
        if (!campaign) throw new AppError("ไม่พบรอบสอบ", 404);
        const updated = await campaignRepo.updateQrActive(campaign_id, campaign.qr_active === 1 ? 0 : 1);
        return { success: true, data: updated };
    },

    async findIsUnlock(campaign_id: number) {
        const campaign = await campaignRepo.findCampaignById(campaign_id);
        if (!campaign) throw new AppError("ไม่พบรอบสอบ", 404);
        return { success: true, data: campaign.is_unlock };
    },

    async updateIsUnlock(campaign_id: number, is_unlock: boolean) {
        const campaign = await campaignRepo.findCampaignById(campaign_id);
        if (!campaign) throw new AppError("ไม่พบรอบสอบ", 404);
        const updated = await campaignRepo.updateIsUnlock(campaign_id, is_unlock);
        return { success: true, data: updated };
    },
}
