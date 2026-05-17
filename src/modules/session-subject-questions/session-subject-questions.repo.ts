import { prisma, type Tx } from "../../cores/prisma";
import type { CreateQuestionBody, UpdateQuestionBody } from "./session-subject-questions.type";

export const sessionSubjectQuestionRepo = {
    async findBySession(session_id: number, campaign_id: number, tx?: Tx) {
        const client = tx ?? prisma;
        return client.session_subject_questions.findMany({
            where: { session_id, campaign_id, deleted_at: null },
            orderBy: { question_no: "asc" },
            include: {
                session_subjects: {
                    include: {
                        campaign_subjects: { include: { subjects: true } },
                    },
                },
            },
        });
    },

    async findBySessionSubject(session_subject_id: number, tx?: Tx) {
        const client = tx ?? prisma;
        return client.session_subject_questions.findMany({
            where: { session_subject_id, deleted_at: null },
            orderBy: { question_no: "asc" },
        });
    },

    async findById(id: number, tx?: Tx) {
        const client = tx ?? prisma;
        return client.session_subject_questions.findFirst({
            where: { id, deleted_at: null },
        });
    },

    async existsByQuestionNoInSession(session_id: number, question_no: number, excludeId?: number, tx?: Tx) {
        const client = tx ?? prisma;
        return client.session_subject_questions.findFirst({
            where: {
                session_id,
                question_no,
                deleted_at: null,
                ...(excludeId !== undefined && { id: { not: excludeId } }),
            },
        });
    },

    async existsByQuestionNoInSubject(session_subject_id: number, question_no: number, excludeId?: number, tx?: Tx) {
        const client = tx ?? prisma;
        return client.session_subject_questions.findFirst({
            where: {
                session_subject_id,
                question_no,
                deleted_at: null,
                ...(excludeId !== undefined && { id: { not: excludeId } }),
            },
        });
    },

    async getMaxQuestionNoInSession(session_id: number, tx?: Tx) {
        const client = tx ?? prisma;
        const result = await client.session_subject_questions.aggregate({
            where: { session_id, deleted_at: null },
            _max: { question_no: true },
        });
        return result._max.question_no ?? 0;
    },

    async create(
        campaign_id: number,
        session_id: number,
        session_subject_id: number,
        data: CreateQuestionBody,
        tx?: Tx,
    ) {
        const client = tx ?? prisma;
        return client.session_subject_questions.create({
            data: {
                campaign_id,
                session_id,
                session_subject_id,
                question_no: data.question_no,
                label: data.label,
                max_score: data.max_score ?? 0,
                question_type: data.question_type ?? "REQUIRED",
                note: data.note ?? null,
            },
        });
    },

    async createMany(
        records: Array<{
            campaign_id: number;
            session_id: number;
            session_subject_id: number;
            question_no: number;
            label: string;
            max_score: number;
            question_type: string;
            note: string | null;
        }>,
        tx?: Tx,
    ) {
        const client = tx ?? prisma;
        return client.session_subject_questions.createMany({ data: records });
    },

    async update(id: number, data: UpdateQuestionBody, tx?: Tx) {
        const client = tx ?? prisma;
        return client.session_subject_questions.update({
            where: { id },
            data: {
                ...(data.question_no !== undefined && { question_no: data.question_no }),
                ...(data.label !== undefined && { label: data.label }),
                ...(data.max_score !== undefined && { max_score: data.max_score }),
                ...(data.question_type !== undefined && { question_type: data.question_type }),
                ...(data.note !== undefined && { note: data.note }),
            },
        });
    },

    async softDelete(id: number, tx?: Tx) {
        const client = tx ?? prisma;
        return client.session_subject_questions.update({
            where: { id },
            data: { deleted_at: new Date() },
        });
    },

    async updateQuestionCount(session_subject_id: number, tx?: Tx) {
        const client = tx ?? prisma;
        const count = await client.session_subject_questions.count({
            where: { session_subject_id, deleted_at: null },
        });
        return client.session_subjects.update({
            where: { id: session_subject_id },
            data: { question_count: count },
        });
    },
};
