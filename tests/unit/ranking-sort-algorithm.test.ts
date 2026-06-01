/**
 * Unit tests: Ranking sort algorithm
 *
 * Replicates the sort comparator from ranking-report.service.ts.
 * Tests: total score ordering, tiebreak by subject priority, fallback to userCode.
 *
 * Run: bun test tests/unit/ranking-sort-algorithm.test.ts
 */
import { describe, it, expect } from "bun:test";

// ── Replicated from ranking-report.service.ts (getRankingData sort block)

interface RankItem {
    userCode: string;
    totalScore: number;
    subjectScores: Record<number, number>;
}

function rankSort(rankingSubjectIds: number[]) {
    return (a: RankItem, b: RankItem): number => {
        const diff = b.totalScore - a.totalScore;
        if (Math.abs(diff) > 0.001) return diff;
        for (const subId of rankingSubjectIds) {
            const d = (b.subjectScores[subId] ?? 0) - (a.subjectScores[subId] ?? 0);
            if (Math.abs(d) > 0.001) return d;
        }
        return (a.userCode ?? "").localeCompare(b.userCode ?? "");
    };
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeCandidate(
    userCode: string,
    totalScore: number,
    subjectScores: Record<number, number> = {},
): RankItem {
    return { userCode, totalScore, subjectScores };
}

function rank(
    candidates: RankItem[],
    rankingSubjectIds: number[],
    limit?: number,
): RankItem[] {
    const sorted = [...candidates].sort(rankSort(rankingSubjectIds));
    return limit !== undefined ? sorted.slice(0, limit) : sorted;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("เรียงตามคะแนนรวมจากมากไปน้อย", () => {
    it("คะแนนสูงกว่าอยู่อันดับสูงกว่า", () => {
        const result = rank(
            [makeCandidate("U002", 60), makeCandidate("U001", 75)],
            [],
        );
        expect(result[0]!.userCode).toBe("U001");
        expect(result[1]!.userCode).toBe("U002");
    });

    it("เรียงผู้สมัครหลายคนถูกต้อง", () => {
        const result = rank(
            [
                makeCandidate("U003", 50),
                makeCandidate("U001", 80),
                makeCandidate("U002", 65),
            ],
            [],
        );
        expect(result.map((r) => r.userCode)).toEqual(["U001", "U002", "U003"]);
    });
});

describe("Tiebreak ด้วยลำดับวิชา", () => {
    it("คะแนนเท่ากัน → tiebreak ด้วยวิชา 1 (subjectId=10)", () => {
        const result = rank(
            [
                makeCandidate("U001", 100, { 10: 45, 20: 30 }),
                makeCandidate("U002", 100, { 10: 50, 20: 25 }),
            ],
            [10, 20],
        );
        expect(result[0]!.userCode).toBe("U002"); // วิชา 10: 50 > 45
    });

    it("คะแนนและวิชา 1 เท่ากัน → tiebreak ด้วยวิชา 2 (subjectId=20)", () => {
        const result = rank(
            [
                makeCandidate("U001", 100, { 10: 50, 20: 28 }),
                makeCandidate("U002", 100, { 10: 50, 20: 32 }),
            ],
            [10, 20],
        );
        expect(result[0]!.userCode).toBe("U002"); // วิชา 20: 32 > 28
    });

    it("เท่ากันทุกอย่าง → เรียงตาม userCode alphabetically", () => {
        const result = rank(
            [
                makeCandidate("U002", 100, { 10: 50, 20: 30 }),
                makeCandidate("U001", 100, { 10: 50, 20: 30 }),
            ],
            [10, 20],
        );
        expect(result[0]!.userCode).toBe("U001"); // U001 < U002 alphabetically
    });

    it("ถ้า OPTIONAL subject ไม่ได้เลือกทำ (subjectScore=0) → score > 0 ชนะ", () => {
        // subjectId=20 is OPTIONAL; U001 skipped it (no key → ?? 0), U002 answered (score=5)
        const result = rank(
            [
                makeCandidate("U001", 100, { 10: 50 }),         // วิชา 20 ไม่ได้เลือกทำ → 0
                makeCandidate("U002", 100, { 10: 50, 20: 5 }), // วิชา 20 ทำได้ 5
            ],
            [10, 20],
        );
        expect(result[0]!.userCode).toBe("U002"); // 5 > 0
    });
});

describe("passingCount จำกัดจำนวนผู้ผ่าน", () => {
    it("slice ตาม passingCount", () => {
        const candidates = Array.from({ length: 10 }, (_, i) =>
            makeCandidate(`U${String(i).padStart(3, "0")}`, 100 - i),
        );
        const result = rank(candidates, [], 3);
        expect(result.length).toBe(3);
        expect(result[0]!.userCode).toBe("U000"); // highest score
    });

    it("passing=0 → empty list", () => {
        const result = rank([makeCandidate("U001", 80)], [], 0);
        expect(result.length).toBe(0);
    });
});

describe("RESET scores ต้องนับเหมือน COMPLETED (ตรวจสอบ aggregation logic)", () => {
    // The aggregation in ranking-report.service.ts groups by (booklet, question)
    // and averages grader1+grader2 regardless of COMPLETED or RESET status.
    // This test validates that logic directly.

    function aggregateSlots(
        slots: Array<{
            bookletId: number;
            questionId: number;
            graderOrder: 1 | 2;
            score: number | null;
            campaignSubjectId: number;
        }>,
    ): Map<number, { totalScore: number; subjectScores: Map<number, number> }> {
        // Replicated from ranking-report.service.ts
        const qMap = new Map<string, { g1: number | null; g2: number | null; campaignSubjectId: number }>();
        for (const slot of slots) {
            const key = `${slot.bookletId}:${slot.questionId}`;
            const existing = qMap.get(key) ?? { g1: null, g2: null, campaignSubjectId: slot.campaignSubjectId };
            if (slot.graderOrder === 1) existing.g1 = slot.score;
            if (slot.graderOrder === 2) existing.g2 = slot.score;
            qMap.set(key, existing);
        }

        const totals = new Map<number, { totalScore: number; subjectScores: Map<number, number> }>();
        for (const [key, q] of qMap.entries()) {
            const bookletId = parseInt(key.split(":")[0]!);
            const avg = q.g1 !== null && q.g2 !== null ? (q.g1 + q.g2) / 2 : (q.g1 ?? q.g2);
            if (avg == null) continue;
            const entry = totals.get(bookletId) ?? { totalScore: 0, subjectScores: new Map() };
            entry.totalScore += avg;
            entry.subjectScores.set(q.campaignSubjectId, (entry.subjectScores.get(q.campaignSubjectId) ?? 0) + avg);
            totals.set(bookletId, entry);
        }
        return totals;
    }

    it("คะแนนหลัง reset ถูกนับใน total (เหมือน COMPLETED)", () => {
        // After reset: scores are updated in grading_scores, slot status = "RESET"
        // getCompletedScores now includes both "COMPLETED" and "RESET" slots
        const slots = [
            { bookletId: 1, questionId: 1, graderOrder: 1 as const, score: 8, campaignSubjectId: 10 },
            { bookletId: 1, questionId: 1, graderOrder: 2 as const, score: 8, campaignSubjectId: 10 },
        ];
        const totals = aggregateSlots(slots);
        expect(totals.get(1)?.totalScore).toBe(8); // avg(8,8) = 8
    });

    it("คะแนนที่เปลี่ยนหลัง reset สะท้อนใน total ถูกต้อง", () => {
        // Original: g1=9, g2=3 (diff=6, DISPUTED)
        // After reset: g1=8, g2=8 → avg=8
        const slots = [
            { bookletId: 1, questionId: 1, graderOrder: 1 as const, score: 8, campaignSubjectId: 10 },
            { bookletId: 1, questionId: 1, graderOrder: 2 as const, score: 8, campaignSubjectId: 10 },
            // Another question, fully completed
            { bookletId: 1, questionId: 2, graderOrder: 1 as const, score: 7, campaignSubjectId: 10 },
            { bookletId: 1, questionId: 2, graderOrder: 2 as const, score: 9, campaignSubjectId: 10 },
        ];
        const totals = aggregateSlots(slots);
        // q1: avg(8,8)=8, q2: avg(7,9)=8 → total=16
        expect(totals.get(1)?.totalScore).toBe(16);
    });

    it("คำนวณ subjectScores ถูกต้องสำหรับ tiebreak", () => {
        const slots = [
            { bookletId: 1, questionId: 1, graderOrder: 1 as const, score: 10, campaignSubjectId: 10 },
            { bookletId: 1, questionId: 1, graderOrder: 2 as const, score: 8, campaignSubjectId: 10 },
            { bookletId: 1, questionId: 2, graderOrder: 1 as const, score: 6, campaignSubjectId: 20 },
            { bookletId: 1, questionId: 2, graderOrder: 2 as const, score: 6, campaignSubjectId: 20 },
        ];
        const totals = aggregateSlots(slots);
        expect(totals.get(1)?.subjectScores.get(10)).toBe(9); // avg(10,8)=9
        expect(totals.get(1)?.subjectScores.get(20)).toBe(6); // avg(6,6)=6
    });
});
