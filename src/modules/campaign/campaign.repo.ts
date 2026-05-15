import { prisma, type Tx } from "../../cores/prisma";

export const campaignRepo = {

    async findCampaignById(id: number, tx?: Tx) {
        const client = tx ?? prisma;
        return await client.exam_campaigns.findUnique({ where: { id } });
    },

    async findActiveCampaignById(id: number, tx?: Tx) {
        const client = tx ?? prisma;
        return await client.exam_campaigns.findFirst({
            where: { id, is_active: true },
        });
    },

    async findActiveCampaigns(tx?: Tx) {
        const client = tx ?? prisma;
        return await client.exam_campaigns.findMany({
            where: { is_active: true },
        });
    },

    async findCampaignWithSessionsAndSubjects(campaign_id: number, tx?: Tx) {
        const client = tx ?? prisma;
        return await client.exam_campaigns.findUnique({
            where: { id: campaign_id },
            include: {
                sessions: {
                    include: {
                        session_subjects: {
                            include: {
                                campaign_subjects: {
                                    include: { subjects: true },
                                },
                            },
                        },
                    },
                    orderBy: { day_no: "asc" },
                },
            },
        });
    },

    async findAllCampaignWithSessionsAndSubjects(tx?: Tx) {
        const client = tx ?? prisma;
        return await client.exam_campaigns.findMany({
            include: {
                sessions: {
                    include: {
                        session_subjects: {
                            include: {
                                campaign_subjects: {
                                    include: { subjects: true },
                                },
                            },
                        },
                    },
                    orderBy: { day_no: "asc" },
                },
            },
        });
    },

    async createCampaign(data: {
        name: string,
        code: string,
        is_active: boolean,
        year_be: string,
        site: string,
        is_unlock: boolean,
        campaign_size: string,
        qr_active: boolean,
    }, tx?: Tx) {
        const client = tx ?? prisma;
        return await client.exam_campaigns.create({ data });
    },

    async updateCampaign(campaign_id: number, data: {
        year_be: string;
        site: string;
        campaign_size: string;
    }, tx?: Tx) {
        const client = tx ?? prisma;
        return await client.exam_campaigns.update({
            where: { id: campaign_id },
            data,
        });
    },

    async updateCampaignIsActive(campaign_id: number, is_active: boolean, tx?: Tx) {
        const client = tx ?? prisma;
        return await client.exam_campaigns.update({
            where: { id: campaign_id },
            data: { is_active },
        });
    },

    async updateQrActive(campaign_id: number, qr_active: boolean, tx?: Tx) {
        const client = tx ?? prisma;
        return await client.exam_campaigns.update({
            where: { id: campaign_id },
            data: { qr_active },
        });
    },

    async updateIsUnlock(campaign_id: number, is_unlock: boolean, tx?: Tx) {
        const client = tx ?? prisma;
        return await client.exam_campaigns.update({
            where: { id: campaign_id },
            data: { is_unlock },
        });
    },
}