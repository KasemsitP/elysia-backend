import { prisma } from "../../cores/prisma";

export const rankingReportRepo = {
    async getCampaign(campaignId: number) {
        return prisma.exam_campaigns.findFirst({
            where: { id: campaignId, deleted_at: null },
            select: { id: true, name: true, year_be: true, campaign_size: true, site: true, is_unlock: true },
        });
    },

    async getSettings(campaignId: number) {
        return prisma.campaign_settings.findMany({
            where: { campaign_id: campaignId, deleted_at: null, active: true },
            select: { setting_key: true, setting_value: true },
        });
    },

    async getBookletsWithUsers(campaignId: number) {
        const booklets = await prisma.booklets.findMany({
            where: { campaign_id: campaignId, deleted_at: null },
            select: { id: true, user_code: true, random_num: true },
        });

        const userCodes = booklets.map((b) => b.user_code).filter((c): c is string => !!c);
        const users =
            userCodes.length > 0
                ? await prisma.users.findMany({
                      where: { user_code: { in: userCodes }, deleted_at: null },
                      select: { user_code: true, title: true, full_name: true },
                  })
                : [];

        const userMap = new Map(users.map((u) => [u.user_code, u]));
        return booklets.map((b) => ({
            id: b.id,
            userCode: b.user_code,
            randomNum: b.random_num,
            title: b.user_code ? (userMap.get(b.user_code)?.title ?? null) : null,
            fullName: b.user_code ? (userMap.get(b.user_code)?.full_name ?? null) : null,
        }));
    },

    async getCompletedScores(bookletIds: number[]) {
        if (bookletIds.length === 0) return [];
        // Include "RESET" so post-reset scores still count toward totals
        return prisma.grading_slots.findMany({
            where: {
                booklet_id: { in: bookletIds },
                status: { in: ["COMPLETED", "RESET"] },
                deleted_at: null,
            },
            select: {
                booklet_id: true,
                session_subject_question_id: true,
                grader_order: true,
                grading_scores: { select: { score: true } },
                session_subject_questions: {
                    select: {
                        session_subjects: { select: { campaign_subject_id: true } },
                    },
                },
            },
        });
    },

    async getCampaignSubjects(campaignId: number) {
        return prisma.campaign_subjects.findMany({
            where: { campaign_id: campaignId, deleted_at: null },
            select: { id: true, name: true },
            orderBy: { order_no: "asc" },
        });
    },
};
