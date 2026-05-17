import { prisma, type Tx } from "../../cores/prisma";
import type { CreateCampaignBody, UpdateCampaignBody } from "./campaign.type";

export const campaignRepo = {
    async findAll(tx?: Tx) {
        const client = tx ?? prisma;
        return client.exam_campaigns.findMany({
            where: { deleted_at: null },
            orderBy: { id: "desc" },
        });
    },

    async findById(id: number, tx?: Tx) {
        const client = tx ?? prisma;
        return client.exam_campaigns.findFirst({
            where: { id, deleted_at: null },
        });
    },

    async findByIdWithDetails(id: number, tx?: Tx) {
        const client = tx ?? prisma;
        return client.exam_campaigns.findFirst({
            where: { id, deleted_at: null },
            include: {
                sessions: {
                    where: { deleted_at: null },
                    orderBy: { day_no: "asc" },
                    include: {
                        session_subjects: {
                            where: { deleted_at: null },
                            orderBy: { order_no: "asc" },
                            include: {
                                campaign_subjects: {
                                    include: { subjects: true },
                                },
                                session_subject_questions: {
                                    where: { deleted_at: null },
                                    orderBy: { question_no: "asc" },
                                },
                            },
                        },
                    },
                },
            },
        });
    },

    async existsByYearAndSize(year_be: string, campaign_size: string, excludeId?: number, tx?: Tx) {
        const client = tx ?? prisma;
        return client.exam_campaigns.findFirst({
            where: {
                year_be,
                campaign_size,
                deleted_at: null,
                ...(excludeId !== undefined && { id: { not: excludeId } }),
            },
        });
    },

    async create(data: CreateCampaignBody, tx?: Tx) {
        const client = tx ?? prisma;
        return client.exam_campaigns.create({
            data: {
                name: data.name ?? null,
                year_be: data.year_be,
                site: data.site ?? null,
                campaign_size: data.campaign_size,
                is_active: data.is_active ?? true,
                is_unlock: data.is_unlock ?? false,
                qr_active: data.qr_active ?? false,
            },
        });
    },

    async update(id: number, data: UpdateCampaignBody, tx?: Tx) {
        const client = tx ?? prisma;
        return client.exam_campaigns.update({
            where: { id },
            data: {
                ...(data.name !== undefined && { name: data.name }),
                ...(data.year_be !== undefined && { year_be: data.year_be }),
                ...(data.site !== undefined && { site: data.site }),
                ...(data.campaign_size !== undefined && { campaign_size: data.campaign_size }),
            },
        });
    },

    async setActive(id: number, is_active: boolean, tx?: Tx) {
        const client = tx ?? prisma;
        return client.exam_campaigns.update({ where: { id }, data: { is_active } });
    },

    async setQrActive(id: number, qr_active: boolean, tx?: Tx) {
        const client = tx ?? prisma;
        return client.exam_campaigns.update({ where: { id }, data: { qr_active } });
    },

    async setIsUnlock(id: number, is_unlock: boolean, tx?: Tx) {
        const client = tx ?? prisma;
        return client.exam_campaigns.update({ where: { id }, data: { is_unlock } });
    },

    async softDelete(id: number, tx?: Tx) {
        const client = tx ?? prisma;
        return client.exam_campaigns.update({
            where: { id },
            data: { deleted_at: new Date() },
        });
    },
};
