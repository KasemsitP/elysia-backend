import { prisma, type Tx } from "../../cores/prisma";
import type { CreateCampaignSubjectBody, UpdateCampaignSubjectBody } from "./campaign-subjects.type";

export const campaignSubjectRepo = {
    async findByCampaign(campaign_id: number, tx?: Tx) {
        const client = tx ?? prisma;
        return client.campaign_subjects.findMany({
            where: { campaign_id, deleted_at: null },
            include: { subjects: true },
            orderBy: { order_no: "asc" },
        });
    },

    async findById(id: number, campaign_id: number, tx?: Tx) {
        const client = tx ?? prisma;
        return client.campaign_subjects.findFirst({
            where: { id, campaign_id, deleted_at: null },
            include: { subjects: true },
        });
    },

    async existsBySubjectId(campaign_id: number, subject_id: number, excludeId?: number, tx?: Tx) {
        const client = tx ?? prisma;
        return client.campaign_subjects.findFirst({
            where: {
                campaign_id,
                subject_id,
                deleted_at: null,
                ...(excludeId !== undefined && { id: { not: excludeId } }),
            },
        });
    },

    async existsByCode(campaign_id: number, code: string, excludeId?: number, tx?: Tx) {
        const client = tx ?? prisma;
        return client.campaign_subjects.findFirst({
            where: {
                campaign_id,
                code,
                deleted_at: null,
                ...(excludeId !== undefined && { id: { not: excludeId } }),
            },
        });
    },

    async existsByOrderNo(campaign_id: number, order_no: number, excludeId?: number, tx?: Tx) {
        const client = tx ?? prisma;
        return client.campaign_subjects.findFirst({
            where: {
                campaign_id,
                order_no,
                deleted_at: null,
                ...(excludeId !== undefined && { id: { not: excludeId } }),
            },
        });
    },

    async create(campaign_id: number, data: CreateCampaignSubjectBody, tx?: Tx) {
        const client = tx ?? prisma;
        return client.campaign_subjects.create({
            data: {
                campaign_id,
                subject_id: data.subject_id,
                code: data.code,
                name: data.name,
                full_score: data.full_score,
                order_no: data.order_no,
                active: data.active ?? true,
            },
            include: { subjects: true },
        });
    },

    async update(id: number, data: UpdateCampaignSubjectBody, tx?: Tx) {
        const client = tx ?? prisma;
        return client.campaign_subjects.update({
            where: { id },
            data: {
                ...(data.code !== undefined && { code: data.code }),
                ...(data.name !== undefined && { name: data.name }),
                ...(data.full_score !== undefined && { full_score: data.full_score }),
                ...(data.order_no !== undefined && { order_no: data.order_no }),
                ...(data.active !== undefined && { active: data.active }),
            },
            include: { subjects: true },
        });
    },

    async softDelete(id: number, tx?: Tx) {
        const client = tx ?? prisma;
        return client.campaign_subjects.update({
            where: { id },
            data: { deleted_at: new Date() },
        });
    },
};
