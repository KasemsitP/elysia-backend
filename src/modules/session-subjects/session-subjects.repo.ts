import { prisma, type Tx } from "../../cores/prisma";
import type { CreateSessionSubjectBody, UpdateSessionSubjectBody } from "./session-subjects.type";

export const sessionSubjectRepo = {
    async findBySession(campaign_id: number, session_id: number, tx?: Tx) {
        const client = tx ?? prisma;
        return client.session_subjects.findMany({
            where: { session_id, campaign_id, deleted_at: null },
            orderBy: { order_no: "asc" },
            include: {
                campaign_subjects: { include: { subjects: true } },
                session_subject_questions: {
                    where: { deleted_at: null },
                    orderBy: { question_no: "asc" },
                },
            },
        });
    },

    async findById(id: number, session_id: number, campaign_id: number, tx?: Tx) {
        const client = tx ?? prisma;
        return client.session_subjects.findFirst({
            where: { id, session_id, campaign_id, deleted_at: null },
            include: {
                campaign_subjects: { include: { subjects: true } },
                session_subject_questions: {
                    where: { deleted_at: null },
                    orderBy: { question_no: "asc" },
                },
            },
        });
    },

    async findByIdOnly(id: number, tx?: Tx) {
        const client = tx ?? prisma;
        return client.session_subjects.findFirst({
            where: { id, deleted_at: null },
            include: {
                campaign_subjects: { include: { subjects: true } },
            },
        });
    },

    async existsByCampaignSubject(session_id: number, campaign_subject_id: number, excludeId?: number, tx?: Tx) {
        const client = tx ?? prisma;
        return client.session_subjects.findFirst({
            where: {
                session_id,
                campaign_subject_id,
                deleted_at: null,
                ...(excludeId !== undefined && { id: { not: excludeId } }),
            },
        });
    },

    async existsByOrderNo(session_id: number, order_no: number, excludeId?: number, tx?: Tx) {
        const client = tx ?? prisma;
        return client.session_subjects.findFirst({
            where: {
                session_id,
                order_no,
                deleted_at: null,
                ...(excludeId !== undefined && { id: { not: excludeId } }),
            },
        });
    },

    async create(campaign_id: number, session_id: number, data: CreateSessionSubjectBody, tx?: Tx) {
        const client = tx ?? prisma;
        return client.session_subjects.create({
            data: {
                campaign_id,
                session_id,
                campaign_subject_id: data.campaign_subject_id,
                start_at: new Date(data.start_at),
                end_at: new Date(data.end_at),
                order_no: data.order_no,
                question_count: 0,
            },
            include: {
                campaign_subjects: { include: { subjects: true } },
            },
        });
    },

    async update(id: number, data: UpdateSessionSubjectBody, tx?: Tx) {
        const client = tx ?? prisma;
        return client.session_subjects.update({
            where: { id },
            data: {
                ...(data.start_at !== undefined && { start_at: new Date(data.start_at) }),
                ...(data.end_at !== undefined && { end_at: new Date(data.end_at) }),
                ...(data.order_no !== undefined && { order_no: data.order_no }),
            },
            include: {
                campaign_subjects: { include: { subjects: true } },
            },
        });
    },

    async softDelete(id: number, tx?: Tx) {
        const client = tx ?? prisma;
        await client.session_subject_questions.updateMany({
            where: { session_subject_id: id, deleted_at: null },
            data: { deleted_at: new Date() },
        });
        return client.session_subjects.update({
            where: { id },
            data: { deleted_at: new Date() },
        });
    },
};
