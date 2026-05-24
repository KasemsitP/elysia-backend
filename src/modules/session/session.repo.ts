import { prisma, type Tx } from "../../cores/prisma";
import type { CreateSessionBody, UpdateSessionBody } from "./session.type";

export const sessionRepo = {
    async findByCampaign(campaign_id: number, tx?: Tx) {
        const client = tx ?? prisma;
        return client.sessions.findMany({
            where:   { campaign_id, deleted_at: null },
            include: {
                session_subjects: {
                    where:   { deleted_at: null },
                    orderBy: { order_no: "asc" },
                    include: { campaign_subjects: { select: { name: true } } },
                },
            },
            orderBy: { day_no: "asc" },
        });
    },

    async findById(id: number, campaign_id: number, tx?: Tx) {
        const client = tx ?? prisma;
        return client.sessions.findFirst({
            where: { id, campaign_id, deleted_at: null },
            include: {
                session_subjects: {
                    where: { deleted_at: null },
                    orderBy: { order_no: "asc" },
                    include: {
                        campaign_subjects: {
                            include: { subjects: true },
                        },
                    },
                },
            },
        });
    },

    async existsByCode(campaign_id: number, session_code: string, excludeId?: number, tx?: Tx) {
        const client = tx ?? prisma;
        return client.sessions.findFirst({
            where: {
                campaign_id,
                session_code,
                deleted_at: null,
                ...(excludeId !== undefined && { id: { not: excludeId } }),
            },
        });
    },

    async existsByDayNo(campaign_id: number, day_no: number, excludeId?: number, tx?: Tx) {
        const client = tx ?? prisma;
        return client.sessions.findFirst({
            where: {
                campaign_id,
                day_no,
                deleted_at: null,
                ...(excludeId !== undefined && { id: { not: excludeId } }),
            },
        });
    },

    async create(campaign_id: number, data: CreateSessionBody, tx?: Tx) {
        const client = tx ?? prisma;
        return client.sessions.create({
            data: {
                campaign_id,
                session_code: data.session_code,
                title: data.title ?? null,
                exam_date: new Date(data.exam_date),
                day_no: data.day_no,
            },
        });
    },

    async update(id: number, data: UpdateSessionBody, tx?: Tx) {
        const client = tx ?? prisma;
        return client.sessions.update({
            where: { id },
            data: {
                ...(data.session_code !== undefined && { session_code: data.session_code }),
                ...(data.title !== undefined && { title: data.title }),
                ...(data.exam_date !== undefined && { exam_date: new Date(data.exam_date) }),
                ...(data.day_no !== undefined && { day_no: data.day_no }),
            },
        });
    },

    async softDelete(id: number, tx?: Tx) {
        const client = tx ?? prisma;
        await client.session_subject_questions.updateMany({
            where: { session_id: id, deleted_at: null },
            data: { deleted_at: new Date() },
        });
        await client.session_subjects.updateMany({
            where: { session_id: id, deleted_at: null },
            data: { deleted_at: new Date() },
        });
        return client.sessions.update({
            where: { id },
            data: { deleted_at: new Date() },
        });
    },
};
