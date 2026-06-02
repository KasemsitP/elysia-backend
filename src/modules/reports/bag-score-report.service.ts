import { AppError } from "../../cores/errors";
import { bagScoreReportRepo as repo } from "./bag-score-report.repo";
import { runPdfWorker } from "../../cores/pdf-runner";

export const bagScoreReportService = {
    async getBagsForDropdown(campaignId: number, filters?: { sessionId?: number; search?: string }) {
        const campaign = await repo.findCampaignById(campaignId);
        if (!campaign) throw new AppError("ไม่พบรอบสอบ", 404);

        const bags = await repo.findBagsForCampaign(campaignId, filters);

        const searched = filters?.search
            ? bags.filter((b) => {
                const s = filters.search!.toLowerCase();
                return (
                    String(b.bag_no).includes(s) ||
                    (b.sessions?.session_code ?? "").toLowerCase().includes(s)
                );
            })
            : bags;

        if (searched.length === 0) return { success: true, data: [] };

        const bagIds = searched.map((b) => b.id);
        const sessionIds = [...new Set(searched.map((b) => b.session_id))];

        const [bookletCounts, sessionSubjects] = await Promise.all([
            repo.countBookletsByBagIds(bagIds),
            repo.findSubjectsBySessionIds(sessionIds),
        ]);

        const countMap = new Map(bookletCounts.map((c) => [c.bag_id!, c._count.id]));
        const subjectMap = new Map<number, string[]>();
        for (const ss of sessionSubjects) {
            const arr = subjectMap.get(ss.session_id) ?? [];
            arr.push(ss.campaign_subjects.name);
            subjectMap.set(ss.session_id, arr);
        }

        const data = searched.map((b) => {
            const count = countMap.get(b.id) ?? 0;
            const session = b.sessions;
            const sessionTitle = session?.title ?? session?.session_code ?? `วันที่ ${session?.day_no ?? ""}`;
            return {
                bagId: b.id,
                bagNo: b.bag_no,
                sessionId: b.session_id,
                sessionCode: session?.session_code ?? "",
                sessionTitle,
                subjectNames: subjectMap.get(b.session_id) ?? [],
                bookletCount: count,
                status: b.status,
                label: `ถุงที่ ${b.bag_no} · ${sessionTitle} · ${count} เล่ม`,
            };
        });

        return { success: true, data };
    },

    async getBagScoreReport(campaignId: number, bagId: number, differenceThreshold = 1) {
        const bag = await repo.findBagWithCampaign(bagId, campaignId);
        if (!bag) throw new AppError("ไม่พบถุงข้อสอบ", 404);

        const campaign = bag.exam_campaigns;
        const session = bag.sessions;
        const isUnlock = campaign.is_unlock;

        const [booklets, questions] = await Promise.all([
            repo.findBookletsInBag(bagId),
            repo.findQuestionsForSession(bag.session_id),
        ]);

        const bookletIds = booklets.map((b) => b.id);
        const questionIds = questions.map((q) => q.id);

        const [slots, sessionSubjects] = await Promise.all([
            repo.findGradingSlotsWithScores(bookletIds, questionIds),
            repo.findSubjectsBySessionIds([bag.session_id]),
        ]);

        const subjectNames = sessionSubjects.map((ss) => ss.campaign_subjects.name);

        // Build score map: `${bookletId}:${questionId}:${graderOrder}` -> score
        const scoreMap = new Map<string, number | null>();
        for (const slot of slots) {
            const key = `${slot.booklet_id}:${slot.session_subject_question_id}:${slot.grader_order}`;
            const raw = slot.grading_scores[0]?.score;
            scoreMap.set(key, raw != null ? Number(raw) : null);
        }

        const questionMeta = questions.map((q) => ({
            sessionSubjectQuestionId: q.id,
            questionNo: q.question_no,
            questionLabel: `ข้อ ${q.question_no}`,
            subjectName: q.session_subjects.campaign_subjects.name,
            maxScore: q.max_score,
            questionType: q.question_type as "REQUIRED" | "OPTIONAL",
            differenceThreshold,
        }));

        // คะแนนเต็มทางทฤษฎี = บวกทุกข้อ (ใช้ใน summary header)
        const maxScore = questions.reduce((sum, q) => sum + q.max_score, 0);
        // คะแนนเต็มขั้นต่ำ = บวกเฉพาะข้อบังคับ (OPTIONAL อาจไม่ทำก็ได้)
        const requiredMaxScore = questions
            .filter((q) => q.question_type !== "OPTIONAL")
            .reduce((sum, q) => sum + q.max_score, 0);
        let completedCount = 0;
        let differenceCount = 0;

        const rows = booklets.map((b) => {
            const scores = questions.map((q) => {
                const g1Key = `${b.id}:${q.id}:1`;
                const g2Key = `${b.id}:${q.id}:2`;
                const hasG1 = scoreMap.has(g1Key);
                const hasG2 = scoreMap.has(g2Key);
                const g1Raw = scoreMap.get(g1Key);
                const g2Raw = scoreMap.get(g2Key);
                const g1 = typeof g1Raw === "number" ? g1Raw : null;
                const g2 = typeof g2Raw === "number" ? g2Raw : null;

                const isOptional = q.question_type === "OPTIONAL";
                const hasBoth = g1 !== null && g2 !== null;
                const hasActualScore = g1 !== null || g2 !== null;
                const hasSlot = hasG1 || hasG2;

                let difference: number | null = null;
                let averageScore: number | null = null;
                let finalScore: number | null = null;
                let hasDifference = false;
                let status: "COMPLETE" | "PARTIAL" | "MISSING" | "SKIPPED";

                if (hasBoth) {
                    difference = Math.round(Math.abs(g1! - g2!) * 100) / 100;
                    averageScore = Math.round(((g1! + g2!) / 2) * 100) / 100;
                    finalScore = averageScore;
                    hasDifference = difference > differenceThreshold;
                    status = "COMPLETE";
                } else if (hasActualScore) {
                    finalScore = g1 ?? g2;
                    status = "PARTIAL";
                } else if (isOptional) {
                    // OPTIONAL + ไม่มีคะแนนจริง → SKIPPED เสมอ แม้จะมี slot อยู่ใน DB
                    status = "SKIPPED";
                } else if (hasSlot) {
                    // REQUIRED + มี slot แต่ยังไม่กรอกคะแนน → PARTIAL
                    status = "PARTIAL";
                } else {
                    status = "MISSING";
                }

                return {
                    sessionSubjectQuestionId: q.id,
                    questionNo: q.question_no,
                    questionType: q.question_type as "REQUIRED" | "OPTIONAL",
                    grader1Score: g1,
                    grader2Score: g2,
                    difference,
                    averageScore,
                    finalScore,
                    hasDifference,
                    status,
                };
            });

            // SKIPPED (optional, no score) is not an error — exclude from missing/partial checks
            const hasMissingRequired = scores.some(
                (s) => s.questionType === "REQUIRED" && (s.status === "MISSING" || s.status === "PARTIAL"),
            );
            const hasPartial = scores.some((s) => s.status === "PARTIAL");
            const allEffectiveDone = scores.every((s) => s.status === "COMPLETE" || s.status === "SKIPPED");

            if (allEffectiveDone) completedCount++;
            if (scores.some((s) => s.hasDifference)) differenceCount++;

            // Sum only cells that have a finalScore (COMPLETE/PARTIAL); skip MISSING and SKIPPED
            const totalScore = scores.reduce((sum, s) => sum + (s.finalScore ?? 0), 0);
            const hasAnyScore = scores.some((s) => s.finalScore !== null);

            // คะแนนเต็มเฉพาะเล่มนี้ = ไม่นับข้อที่ SKIPPED (OPTIONAL ที่ไม่ได้ทำ)
            const effectiveMaxScore = scores.reduce(
                (sum, s, i) => sum + (s.status !== "SKIPPED" ? (questions[i]?.max_score ?? 0) : 0),
                0,
            );

            const rowStatus: "COMPLETE" | "PARTIAL" | "MISSING" =
                allEffectiveDone ? "COMPLETE"
                : hasMissingRequired && !hasAnyScore ? "MISSING"
                : "PARTIAL";

            return {
                bookletId: b.id,
                displayCode: b.random_num ?? String(b.id),
                seqInBag: b.seq_in_bag,
                randomNum: b.random_num,
                userCode: isUnlock ? (b.user_code ?? null) : null,
                fullName: null,
                scores,
                totalScore: hasAnyScore ? Math.round(totalScore * 100) / 100 : null,
                effectiveMaxScore,
                status: rowStatus,
            };
        });

        const sessionTitle = session?.title ?? session?.session_code ?? null;

        return {
            success: true,
            data: {
                campaign: {
                    id: campaign.id,
                    name: campaign.name,
                    yearBe: campaign.year_be,
                    campaignSize: campaign.campaign_size,
                    isUnlock,
                },
                bag: {
                    bagId: bag.id,
                    bagNo: bag.bag_no,
                    sessionId: bag.session_id,
                    sessionCode: session?.session_code ?? "",
                    sessionTitle,
                    bookletCount: booklets.length,
                    status: bag.status,
                    subjectNames,
                },
                summary: {
                    questionCount: questions.length,
                    bookletCount: booklets.length,
                    completedCount,
                    incompleteCount: booklets.length - completedCount,
                    differenceCount,
                    maxScore,           // คะแนนเต็มทางทฤษฎี (รวม OPTIONAL ทุกข้อ)
                    requiredMaxScore,   // คะแนนเต็มขั้นต่ำ (เฉพาะข้อบังคับ)
                },
                questions: questionMeta,
                rows,
            },
        };
    },

    async getBagScorePdf(campaignId: number, bagId: number) {
        const report = await bagScoreReportService.getBagScoreReport(campaignId, bagId);
        const { bagNo } = report.data.bag;
        const pdfBuffer = await runPdfWorker("bag-score-report", report.data);
        return new Response(pdfBuffer, {
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `attachment; filename="bag_score_report_campaign_${campaignId}_bag_${bagNo}.pdf"`,
                "Content-Length": String(pdfBuffer.length),
            },
        });
    },

    async getAllBagScorePdf(campaignId: number, sessionId?: number) {
        const campaign = await repo.findCampaignById(campaignId);
        if (!campaign) throw new AppError("ไม่พบรอบสอบ", 404);

        const bags = await repo.findBagsForCampaign(
            campaignId,
            sessionId ? { sessionId } : undefined,
        );

        const reports = await Promise.all(
            bags.map((b) =>
                bagScoreReportService
                    .getBagScoreReport(campaignId, b.id)
                    .then((r) => r.data)
                    .catch(() => null),
            ),
        );
        const validReports = reports.filter((r): r is NonNullable<typeof r> => r !== null);

        const pdfBuffer = await runPdfWorker("bag-score-report-all", {
            campaign: { id: campaign.id, name: campaign.name },
            bags: validReports,
        });

        return new Response(pdfBuffer, {
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `attachment; filename="bag_score_report_campaign_${campaignId}_all.pdf"`,
                "Content-Length": String(pdfBuffer.length),
            },
        });
    },
};
