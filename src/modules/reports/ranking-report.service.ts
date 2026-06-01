import { AppError } from "../../cores/errors";
import { rankingReportRepo as repo } from "./ranking-report.repo";
import { runPdfWorker } from "../../cores/pdf-runner";

export type RankingRow = {
    rank: number;
    bookletId: number;
    userCode: string | null;
    title: string | null;
    fullName: string | null;
    totalScore: number;
    subjectScores: Record<number, number>;
};

export type RankingReportData = {
    campaign: {
        id: number;
        name: string | null;
        yearBe: string;
        campaignSize: string;
        site: string | null;
    };
    passingCount: number;
    rankingSubjectIds: number[];
    subjectNames: Record<number, string>;
    rows: RankingRow[];
};

export const rankingReportService = {
    async getRankingData(campaignId: number): Promise<RankingReportData> {
        const campaign = await repo.getCampaign(campaignId);
        if (!campaign) throw new AppError("ไม่พบรอบสอบ", 404);
        if (!campaign.is_unlock) throw new AppError("รอบสอบนี้ยังไม่ถอดรหัส ไม่สามารถออกรายชื่อผู้สอบผ่านได้", 400);

        // Load settings
        const settingsRaw = await repo.getSettings(campaignId);
        const settingsMap = Object.fromEntries(settingsRaw.map((s) => [s.setting_key, s.setting_value]));
        const passingCount = Math.max(1, Number(settingsMap.passing_candidate_count ?? 50));

        let rankingSubjectIds: number[] = [];
        try {
            const raw = settingsMap.ranking_subject_priority;
            if (raw && typeof raw === "object" && Array.isArray((raw as { subjectIds?: unknown }).subjectIds)) {
                rankingSubjectIds = ((raw as { subjectIds: unknown[] }).subjectIds as number[]).map(Number);
            }
        } catch { /* ignore */ }

        // Load booklets + users
        const booklets = await repo.getBookletsWithUsers(campaignId);
        const bookletIds = booklets.map((b) => b.id);

        // Load scores + subjects in parallel
        const [slots, subjectRows] = await Promise.all([
            repo.getCompletedScores(bookletIds),
            repo.getCampaignSubjects(campaignId),
        ]);

        const subjectNameMap = new Map(subjectRows.map((s) => [s.id, s.name]));

        // Build per (booklet, question) score map — grader_order 1 & 2
        const qScoreMap = new Map<string, { g1: number | null; g2: number | null; campaignSubjectId: number }>();
        for (const slot of slots) {
            const key = `${slot.booklet_id}:${slot.session_subject_question_id}`;
            const score = slot.grading_scores[0]?.score != null ? Number(slot.grading_scores[0].score) : null;
            const campaignSubjectId = slot.session_subject_questions.session_subjects.campaign_subject_id;
            const existing = qScoreMap.get(key) ?? { g1: null, g2: null, campaignSubjectId };
            if (slot.grader_order === 1) existing.g1 = score;
            if (slot.grader_order === 2) existing.g2 = score;
            qScoreMap.set(key, existing);
        }

        // Aggregate per-booklet: totalScore + subjectScores
        const bookletTotals = new Map<number, { totalScore: number; subjectScores: Map<number, number> }>();
        for (const [key, q] of qScoreMap.entries()) {
            const bookletId = parseInt(key.split(":")[0]!);
            const avg = q.g1 !== null && q.g2 !== null
                ? (q.g1 + q.g2) / 2
                : (q.g1 ?? q.g2);
            if (avg == null) continue;

            const entry = bookletTotals.get(bookletId) ?? { totalScore: 0, subjectScores: new Map() };
            entry.totalScore += avg;
            entry.subjectScores.set(q.campaignSubjectId, (entry.subjectScores.get(q.campaignSubjectId) ?? 0) + avg);
            bookletTotals.set(bookletId, entry);
        }

        // Build + sort ranked list
        const bookletMap = new Map(booklets.map((b) => [b.id, b]));
        const ranked = Array.from(bookletTotals.entries())
            .map(([bookletId, totals]) => {
                const bk = bookletMap.get(bookletId);
                return {
                    bookletId,
                    userCode: bk?.userCode ?? null,
                    title: bk?.title ?? null,
                    fullName: bk?.fullName ?? null,
                    totalScore: Math.round(totals.totalScore * 100) / 100,
                    subjectScores: Object.fromEntries(totals.subjectScores) as Record<number, number>,
                };
            })
            .filter((r) => r.userCode != null)
            .sort((a, b) => {
                const diff = b.totalScore - a.totalScore;
                if (Math.abs(diff) > 0.001) return diff;
                for (const subId of rankingSubjectIds) {
                    const d = (b.subjectScores[subId] ?? 0) - (a.subjectScores[subId] ?? 0);
                    if (Math.abs(d) > 0.001) return d;
                }
                return (a.userCode ?? "").localeCompare(b.userCode ?? "");
            })
            .slice(0, passingCount)
            .map((r, i) => ({ ...r, rank: i + 1 }));

        return {
            campaign: {
                id: campaign.id,
                name: campaign.name,
                yearBe: campaign.year_be,
                campaignSize: campaign.campaign_size,
                site: campaign.site,
            },
            passingCount,
            rankingSubjectIds,
            subjectNames: Object.fromEntries(subjectNameMap) as Record<number, string>,
            rows: ranked,
        };
    },

    async getRankingPdf(campaignId: number) {
        const data = await rankingReportService.getRankingData(campaignId);
        const pdfBuffer = await runPdfWorker("ranking-report", data);
        return new Response(pdfBuffer, {
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `attachment; filename="ranking_campaign_${campaignId}.pdf"`,
                "Content-Length": String(pdfBuffer.length),
            },
        });
    },
};
