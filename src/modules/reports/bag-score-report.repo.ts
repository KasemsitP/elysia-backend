import { prisma } from "../../cores/prisma";

export const bagScoreReportRepo = {
    async findCampaignById(campaignId: number) {
        return prisma.exam_campaigns.findFirst({
            where: { id: campaignId, deleted_at: null },
            select: { id: true, name: true, year_be: true, campaign_size: true, is_unlock: true },
        });
    },

    async findBagsForCampaign(campaignId: number, filters?: { sessionId?: number }) {
        return prisma.bags.findMany({
            where: {
                campaign_id: campaignId,
                deleted_at: null,
                ...(filters?.sessionId ? { session_id: filters.sessionId } : {}),
            },
            include: {
                sessions: { select: { id: true, session_code: true, title: true, day_no: true } },
            },
            orderBy: [{ sessions: { day_no: "asc" } }, { bag_no: "asc" }],
        });
    },

    async countBookletsByBagIds(bagIds: number[]) {
        if (bagIds.length === 0) return [];
        return prisma.booklets.groupBy({
            by: ["bag_id"],
            where: { bag_id: { in: bagIds }, deleted_at: null },
            _count: { id: true },
        });
    },

    async findSubjectsBySessionIds(sessionIds: number[]) {
        if (sessionIds.length === 0) return [];
        return prisma.session_subjects.findMany({
            where: { session_id: { in: sessionIds }, deleted_at: null },
            include: { campaign_subjects: { select: { name: true } } },
            orderBy: { order_no: "asc" },
        });
    },

    async findBagWithCampaign(bagId: number, campaignId: number) {
        return prisma.bags.findFirst({
            where: { id: bagId, campaign_id: campaignId, deleted_at: null },
            include: {
                sessions: { select: { id: true, session_code: true, title: true, day_no: true } },
                exam_campaigns: {
                    select: { id: true, name: true, year_be: true, campaign_size: true, is_unlock: true },
                },
            },
        });
    },

    async findBookletsInBag(bagId: number) {
        return prisma.booklets.findMany({
            where: { bag_id: bagId, deleted_at: null },
            select: { id: true, seq_in_bag: true, random_num: true, user_code: true, status: true },
            orderBy: { seq_in_bag: "asc" },
        });
    },

    async findQuestionsForSession(sessionId: number) {
        return prisma.session_subject_questions.findMany({
            where: { session_id: sessionId, deleted_at: null },
            select: {
                id: true,
                question_no: true,
                label: true,
                max_score: true,
                question_type: true,
                session_subjects: {
                    include: { campaign_subjects: { select: { name: true } } },
                },
            },
            orderBy: [{ session_subjects: { order_no: "asc" } }, { question_no: "asc" }],
        });
    },

    async findGradingSlotsWithScores(bookletIds: number[], questionIds: number[]) {
        if (bookletIds.length === 0 || questionIds.length === 0) return [];
        return prisma.grading_slots.findMany({
            where: {
                booklet_id: { in: bookletIds },
                session_subject_question_id: { in: questionIds },
                deleted_at: null,
            },
            select: {
                booklet_id: true,
                session_subject_question_id: true,
                grader_order: true,
                status: true,
                grading_scores: { select: { score: true } },
            },
        });
    },
};
