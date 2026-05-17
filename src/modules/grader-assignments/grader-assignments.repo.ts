import { prisma, type Tx } from "../../cores/prisma";
import type { CreateAssignmentBody } from "./grader-assignments.type";

export const graderAssignmentRepo = {
    async findByCampaign(campaign_id: number, tx?: Tx) {
        const client = tx ?? prisma;
        return client.grader_assignments.findMany({
            where: { campaign_id, deleted_at: null },
            include: {
                graders: {
                    include: {
                        accounts: { select: { id: true, full_name: true, username: true } },
                    },
                },
                session_subject_questions: { select: { id: true, question_no: true, label: true, max_score: true } },
                campaign_subjects: { select: { id: true, code: true, name: true } },
                sessions: { select: { id: true, session_code: true, day_no: true } },
            },
            orderBy: { id: "asc" },
        });
    },

    async findByGrader(grader_id: number, tx?: Tx) {
        const client = tx ?? prisma;
        return client.grader_assignments.findMany({
            where: { grader_id, deleted_at: null },
            include: {
                session_subject_questions: { select: { id: true, question_no: true, label: true, max_score: true } },
                campaign_subjects: { select: { id: true, code: true, name: true } },
                sessions: { select: { id: true, session_code: true, day_no: true } },
            },
            orderBy: { id: "asc" },
        });
    },

    async findById(id: number, tx?: Tx) {
        const client = tx ?? prisma;
        return client.grader_assignments.findFirst({
            where: { id, deleted_at: null },
        });
    },

    // ตรวจสอบ unique constraint: grader_id + session_subject_question_id
    async existsByGraderAndQuestion(grader_id: number, session_subject_question_id: number, excludeId?: number, tx?: Tx) {
        const client = tx ?? prisma;
        return client.grader_assignments.findFirst({
            where: {
                grader_id,
                session_subject_question_id,
                deleted_at: null,
                ...(excludeId !== undefined && { id: { not: excludeId } }),
            },
        });
    },

    async create(campaign_id: number, data: CreateAssignmentBody, tx?: Tx) {
        const client = tx ?? prisma;
        return client.grader_assignments.create({
            data: {
                campaign_id,
                grader_id: data.grader_id,
                session_id: data.session_id,
                campaign_subject_id: data.campaign_subject_id,
                session_subject_id: data.session_subject_id,
                session_subject_question_id: data.session_subject_question_id,
            },
        });
    },

    async update(id: number, active: boolean, tx?: Tx) {
        const client = tx ?? prisma;
        return client.grader_assignments.update({
            where: { id },
            data: { active },
        });
    },

    async softDelete(id: number, tx?: Tx) {
        const client = tx ?? prisma;
        return client.grader_assignments.update({
            where: { id },
            data: { deleted_at: new Date() },
        });
    },
};
