import { prisma } from "../../cores/prisma";

export const scoreResetRepo = {
    async getThreshold(campaignId: number): Promise<number> {
        const s = await prisma.campaign_settings.findFirst({
            where: { campaign_id: campaignId, setting_key: "reset_threshold", deleted_at: null, active: true },
            select: { setting_value: true },
        });
        return Number(s?.setting_value ?? 3);
    },

    async findDisputedOrResetSlots(campaignId: number, statuses: string[]) {
        return prisma.grading_slots.findMany({
            where: { campaign_id: campaignId, status: { in: statuses }, deleted_at: null },
            select: {
                id: true, booklet_id: true, session_subject_question_id: true,
                grader_order: true, grader_id: true, status: true,
                session_id: true, campaign_id: true, campaign_subject_id: true, session_subject_id: true,
                grading_scores: { select: { id: true, score: true } },
            },
        });
    },

    async findBookletsForIds(ids: number[]) {
        if (!ids.length) return [];
        return prisma.booklets.findMany({
            where: { id: { in: ids }, deleted_at: null },
            select: { id: true, bag_id: true, seq_in_bag: true, random_num: true, session_id: true },
        });
    },

    async findBagsForIds(ids: number[]) {
        if (!ids.length) return [];
        return prisma.bags.findMany({
            where: { id: { in: ids }, deleted_at: null },
            select: { id: true, bag_no: true, session_id: true, sessions: { select: { session_code: true, title: true } } },
        });
    },

    async findQuestionsForIds(ids: number[]) {
        if (!ids.length) return [];
        return prisma.session_subject_questions.findMany({
            where: { id: { in: ids }, deleted_at: null },
            select: {
                id: true, question_no: true, label: true, max_score: true,
                session_subjects: { select: { campaign_subject_id: true, campaign_subjects: { select: { id: true, name: true } } } },
            },
        });
    },

    async findAllDisputedSlotsForBooklet(bookletId: number, campaignId: number) {
        return prisma.grading_slots.findMany({
            where: { booklet_id: bookletId, campaign_id: campaignId, status: "DISPUTED", deleted_at: null },
            select: { id: true, session_subject_question_id: true, grader_order: true, status: true },
        });
    },

    async findBookletByQrPayload(qrPayload: string) {
        return prisma.booklets.findUnique({
            where: { qr_payload: qrPayload },
            select: { id: true, campaign_id: true, bag_id: true, random_num: true, session_id: true },
        });
    },

    async findSlotsForCase(bookletId: number, questionId: number) {
        return prisma.grading_slots.findMany({
            where: { booklet_id: bookletId, session_subject_question_id: questionId, deleted_at: null },
            select: {
                id: true, grader_order: true, grader_id: true, status: true,
                campaign_id: true, session_id: true, campaign_subject_id: true, session_subject_id: true,
                grading_scores: { select: { id: true, score: true } },
                session_subject_questions: {
                    select: { max_score: true, question_no: true, label: true,
                        session_subjects: { select: { campaign_subjects: { select: { name: true } } } } },
                },
            },
            orderBy: { grader_order: "asc" },
        });
    },
};
