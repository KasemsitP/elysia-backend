import { AppError } from "../../cores/errors";
import { prisma } from "../../cores/prisma";

// ── Helper: ดึง setting value จาก campaign_settings ──────────────────────────
async function getSetting(campaign_id: number, key: string): Promise<string | null> {
    const s = await prisma.campaign_settings.findFirst({
        where: { campaign_id, setting_key: key, active: true, deleted_at: null },
    });
    return s ? String(s.setting_value) : null;
}

export const reportService = {
    // ── Bag Scores ─────────────────────────────────────────────────────────────
    // Locked mode: แสดง random_num แทน user_code/ชื่อ
    // Unlocked mode: แสดง user_code + ชื่อจริง
    async bagScores(bagId: number) {
        const bag = await prisma.bags.findFirst({
            where: { id: bagId, deleted_at: null },
            include: { exam_campaigns: { select: { id: true, is_unlock: true } } },
        });
        if (!bag) throw new AppError("ไม่พบถุง", 404);

        const isUnlocked = bag.exam_campaigns.is_unlock;

        const booklets = await prisma.booklets.findMany({
            where: { bag_id: bagId, deleted_at: null },
            orderBy: { seq_in_bag: "asc" },
        });

        const slots = await prisma.grading_slots.findMany({
            where: { booklets: { bag_id: bagId }, deleted_at: null },
            include: {
                grading_scores: true,
                session_subject_questions: { select: { question_no: true, label: true, max_score: true } },
            },
        });

        const data = booklets.map((b) => {
            const bookletSlots = slots.filter((s) => s.booklet_id === b.id);
            const questionMap = new Map<
                number,
                { question_no: number; label: string; max_score: number; grader1: number | null; grader2: number | null; status: string }
            >();

            for (const slot of bookletSlots) {
                const qId = slot.session_subject_question_id;
                const existing = questionMap.get(qId) ?? {
                    question_no: slot.session_subject_questions.question_no,
                    label: slot.session_subject_questions.label,
                    max_score: slot.session_subject_questions.max_score,
                    grader1: null,
                    grader2: null,
                    status: slot.status,
                };
                const score = slot.grading_scores[0]?.score ?? null;
                if (slot.grader_order === 1) existing.grader1 = score;
                if (slot.grader_order === 2) existing.grader2 = score;
                existing.status = slot.status;
                questionMap.set(qId, existing);
            }

            return {
                booklet_id: b.id,
                seq_in_bag: b.seq_in_bag,
                // ป้องกันการเปิดเผยตัวตนก่อน unlock
                identifier: isUnlocked ? (b.user_code ?? b.random_num) : b.random_num,
                user_code: isUnlocked ? b.user_code : null,
                questions: Array.from(questionMap.values()).sort((a, b) => a.question_no - b.question_no),
            };
        });

        return {
            success: true,
            message: "ดึงรายงานคะแนนถุงสำเร็จ",
            data: {
                bag_no: bag.bag_no,
                campaign_unlocked: isUnlocked,
                booklets: data,
            },
        };
    },

    // ── Campaign Score Summary ─────────────────────────────────────────────────
    async campaignScoreSummary(campaignId: number) {
        const campaign = await prisma.exam_campaigns.findFirst({
            where: { id: campaignId, deleted_at: null },
        });
        if (!campaign) throw new AppError("ไม่พบรอบสอบ", 404);

        const totalBooklets = await prisma.booklets.count({
            where: { campaign_id: campaignId, deleted_at: null },
        });
        const packagedBooklets = await prisma.booklets.count({
            where: { campaign_id: campaignId, status: "PACKAGED", deleted_at: null },
        });
        const totalBags = await prisma.bags.count({
            where: { campaign_id: campaignId, deleted_at: null },
        });
        const completedSlots = await prisma.grading_slots.count({
            where: { campaign_id: campaignId, status: "COMPLETED", deleted_at: null },
        });
        const disputedSlots = await prisma.grading_slots.count({
            where: { campaign_id: campaignId, status: "DISPUTED", deleted_at: null },
        });
        const totalSlots = await prisma.grading_slots.count({
            where: { campaign_id: campaignId, deleted_at: null },
        });

        return {
            success: true,
            message: "ดึงสรุปคะแนนสำเร็จ",
            data: {
                campaign_id: campaignId,
                campaign_unlocked: campaign.is_unlock,
                total_booklets: totalBooklets,
                packaged_booklets: packagedBooklets,
                total_bags: totalBags,
                grading_progress: {
                    total_slots: totalSlots,
                    completed_slots: completedSlots,
                    disputed_slots: disputedSlots,
                    completion_rate: totalSlots > 0 ? Math.round((completedSlots / totalSlots) * 100) : 0,
                },
            },
        };
    },

    // ── Grader Workload ────────────────────────────────────────────────────────
    async graderWorkload(campaignId: number) {
        const campaign = await prisma.exam_campaigns.findFirst({
            where: { id: campaignId, deleted_at: null },
        });
        if (!campaign) throw new AppError("ไม่พบรอบสอบ", 404);

        const graders = await prisma.graders.findMany({
            where: { campaign_id: campaignId, deleted_at: null },
            include: {
                accounts: { select: { id: true, full_name: true, username: true } },
            },
        });

        const data = await Promise.all(
            graders.map(async (g) => {
                const confirmedSlots = await prisma.grading_slots.count({
                    where: { grader_id: g.id, campaign_id: campaignId, status: "COMPLETED" },
                });
                const assignedQuestions = await prisma.grader_assignments.count({
                    where: { grader_id: g.id, campaign_id: campaignId, active: true, deleted_at: null },
                });
                return {
                    grader_id: g.id,
                    account_id: g.account_id,
                    full_name: g.accounts?.full_name ?? "-",
                    username: g.accounts?.username ?? "-",
                    confirmed_slots: confirmedSlots,
                    assigned_questions: assignedQuestions,
                };
            }),
        );

        return { success: true, message: "ดึงข้อมูล workload สำเร็จ", data };
    },

    // ── Grader Payment ─────────────────────────────────────────────────────────
    async graderPayment(campaignId: number) {
        const campaign = await prisma.exam_campaigns.findFirst({
            where: { id: campaignId, deleted_at: null },
        });
        if (!campaign) throw new AppError("ไม่พบรอบสอบ", 404);

        // payment_rate_per_booklet จาก campaign_settings (default 30 บาท)
        const rateStr = await getSetting(campaignId, "payment_rate_per_booklet");
        const ratePerBooklet = rateStr ? Number(rateStr) : 30;

        const graders = await prisma.graders.findMany({
            where: { campaign_id: campaignId, deleted_at: null },
            include: { accounts: { select: { full_name: true, username: true } } },
        });

        const data = await Promise.all(
            graders.map(async (g) => {
                const confirmedSlots = await prisma.grading_slots.count({
                    where: { grader_id: g.id, campaign_id: campaignId, status: "COMPLETED" },
                });
                return {
                    grader_id: g.id,
                    full_name: g.accounts?.full_name ?? "-",
                    username: g.accounts?.username ?? "-",
                    confirmed_slots: confirmedSlots,
                    rate_per_booklet: ratePerBooklet,
                    total_payment: confirmedSlots * ratePerBooklet,
                };
            }),
        );

        return { success: true, message: "ดึงข้อมูลค่าตรวจสำเร็จ", data };
    },

    // ── Passing List ──────────────────────────────────────────────────────────
    // คำนวณผู้ผ่านตาม passing_policy, passing_quota, minimum_passing_score
    async passingList(campaignId: number) {
        const campaign = await prisma.exam_campaigns.findFirst({
            where: { id: campaignId, deleted_at: null },
        });
        if (!campaign) throw new AppError("ไม่พบรอบสอบ", 404);

        const passingQuotaStr = await getSetting(campaignId, "passing_quota");
        const minScoreStr = await getSetting(campaignId, "minimum_passing_score");
        const passingPolicy = (await getSetting(campaignId, "passing_policy")) ?? "MINIMUM_SCORE";

        const passingQuota = passingQuotaStr ? Number(passingQuotaStr) : null;
        const minScore = minScoreStr ? Number(minScoreStr) : 0;

        // ดึง booklet + sum คะแนนที่ confirmed แล้ว (grader_order=1 เป็นหลัก ถ้ามีก็ใช้ average)
        const booklets = await prisma.booklets.findMany({
            where: { campaign_id: campaignId, deleted_at: null },
            orderBy: { id: "asc" },
        });

        const scoredBooklets = await Promise.all(
            booklets.map(async (b) => {
                const scores = await prisma.grading_scores.findMany({
                    where: { grading_slots: { booklet_id: b.id, status: "COMPLETED" } },
                    include: { grading_slots: { select: { grader_order: true, session_subject_question_id: true } } },
                });

                // sum คะแนน grader 1 ต่อแต่ละข้อ
                const questionScores = new Map<number, number>();
                for (const score of scores) {
                    if (score.grading_slots.grader_order === 1) {
                        const qId = score.grading_slots.session_subject_question_id;
                        questionScores.set(qId, score.score);
                    }
                }
                const total = Array.from(questionScores.values()).reduce((a, b) => a + b, 0);

                return {
                    booklet_id: b.id,
                    identifier: campaign.is_unlock ? (b.user_code ?? b.random_num) : b.random_num,
                    user_code: campaign.is_unlock ? b.user_code : null,
                    total_score: total,
                    question_count: questionScores.size,
                };
            }),
        );

        // เรียงตามคะแนนสูงสุด
        scoredBooklets.sort((a, b) => b.total_score - a.total_score);

        // ใช้ passing policy
        const withPassStatus = scoredBooklets.map((b, idx) => {
            let passed = false;
            if (passingPolicy === "QUOTA" && passingQuota !== null) {
                passed = idx < passingQuota;
            } else if (passingPolicy === "MINIMUM_SCORE") {
                passed = b.total_score >= minScore;
            } else if (passingPolicy === "BOTH" && passingQuota !== null) {
                passed = idx < passingQuota && b.total_score >= minScore;
            } else {
                passed = b.total_score >= minScore;
            }
            return { ...b, rank: idx + 1, passed };
        });

        return {
            success: true,
            message: "ดึงรายชื่อผู้ผ่านสำเร็จ",
            data: {
                campaign_unlocked: campaign.is_unlock,
                passing_policy: passingPolicy,
                passing_quota: passingQuota,
                minimum_passing_score: minScore,
                total_candidates: scoredBooklets.length,
                total_passed: withPassStatus.filter((b) => b.passed).length,
                candidates: withPassStatus,
            },
        };
    },
};
