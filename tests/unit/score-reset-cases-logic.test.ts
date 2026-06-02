/**
 * Unit tests: Score reset cases — pure data logic
 *
 * Replicates filtering, sorting, pagination, and pair-status logic
 * from src/modules/score-reset/score-reset.service.ts (getCases).
 *
 * Run: bun test tests/unit/score-reset-cases-logic.test.ts
 */
import { describe, it, expect } from "bun:test";

// ── Types ──────────────────────────────────────────────────────────────────────

type CaseItem = {
    caseId: string;
    bookletId: number;
    questionId: number;
    bagId: number | null;
    bagNo: number | null;
    randomNum: string | null;
    questionNo: number;
    questionLabel: string;
    subjectId: number | null;
    subjectName: string;
    g1Score: number | null;
    g2Score: number | null;
    difference: number;
    averageScore: number;
    pairStatus: "PENDING" | "RESET_DONE";
};

// ── Replicated from score-reset.service.ts ─────────────────────────────────────

function sortCases(
    cases: CaseItem[],
    sortBy: "bagNo" | "questionNo" | "difference" | "randomNum",
    sortOrder: "asc" | "desc",
): CaseItem[] {
    return [...cases].sort((a, b) => {
        let diff = 0;
        if (sortBy === "bagNo")       diff = (a.bagNo ?? 0) - (b.bagNo ?? 0);
        else if (sortBy === "questionNo") diff = a.questionNo - b.questionNo;
        else if (sortBy === "difference") diff = a.difference - b.difference;
        else if (sortBy === "randomNum")  diff = (a.randomNum ?? "").localeCompare(b.randomNum ?? "");
        return sortOrder === "desc" ? -diff : diff;
    });
}

function filterCases(
    cases: CaseItem[],
    opts: {
        bagId?: number;
        sessionSubjectQuestionId?: number;
        subjectId?: number;
        search?: string;
    },
): CaseItem[] {
    let filtered = cases;
    if (opts.bagId != null)
        filtered = filtered.filter((c) => c.bagId === opts.bagId);
    if (opts.sessionSubjectQuestionId != null)
        filtered = filtered.filter((c) => c.questionId === opts.sessionSubjectQuestionId);
    if (opts.subjectId != null)
        filtered = filtered.filter((c) => c.subjectId === opts.subjectId);
    if (opts.search) {
        const lower = opts.search.toLowerCase();
        filtered = filtered.filter(
            (c) =>
                (c.randomNum ?? "").toLowerCase().includes(lower) ||
                c.questionLabel.toLowerCase().includes(lower),
        );
    }
    return filtered;
}

function paginateCases(cases: CaseItem[], page: number, limit: number) {
    const total = cases.length;
    const skip = (page - 1) * limit;
    const paged = cases.slice(skip, skip + limit);
    return { items: paged, total, page, limit, totalPages: Math.ceil(total / limit) };
}

function computePairStatus(slots: Array<{ status: string }>): "PENDING" | "RESET_DONE" {
    const bothReset = slots.length > 0 && slots.every((s) => s.status === "RESET");
    return bothReset ? "RESET_DONE" : "PENDING";
}

function computeDifference(g1: number | null, g2: number | null): number {
    return g1 != null && g2 != null ? Math.abs(g1 - g2) : 0;
}

function computeAverage(g1: number | null, g2: number | null): number {
    return g1 != null && g2 != null ? (g1 + g2) / 2 : 0;
}

function computeCaseCount(slots: Array<{ booklet_id: number }>, bagId: number, booklets: Array<{ id: number; bag_id: number | null }>): number {
    const bookletMap = new Map(booklets.map((b) => [b.id, b]));
    let count = 0;
    for (const slot of slots) {
        const booklet = bookletMap.get(slot.booklet_id);
        if (booklet?.bag_id === bagId) count++;
    }
    return Math.ceil(count / 2);
}

// ── Fixture ────────────────────────────────────────────────────────────────────

function makeCase(overrides: Partial<CaseItem> = {}): CaseItem {
    return {
        caseId: "1_1",
        bookletId: 1,
        questionId: 1,
        bagId: 1,
        bagNo: 1,
        randomNum: "10001",
        questionNo: 1,
        questionLabel: "ข้อ 1 สัญญา",
        subjectId: 10,
        subjectName: "กฎหมายอาญา",
        g1Score: 9,
        g2Score: 3,
        difference: 6,
        averageScore: 6,
        pairStatus: "PENDING",
        ...overrides,
    };
}

// ── computePairStatus ──────────────────────────────────────────────────────────

describe("computePairStatus: สถานะคู่ slot", () => {
    it("slots ทั้งหมด RESET → RESET_DONE", () => {
        expect(computePairStatus([{ status: "RESET" }, { status: "RESET" }])).toBe("RESET_DONE");
    });

    it("slot หนึ่ง DISPUTED → PENDING", () => {
        expect(computePairStatus([{ status: "RESET" }, { status: "DISPUTED" }])).toBe("PENDING");
    });

    it("ทั้งหมด DISPUTED → PENDING", () => {
        expect(computePairStatus([{ status: "DISPUTED" }, { status: "DISPUTED" }])).toBe("PENDING");
    });

    it("slots ว่าง → PENDING", () => {
        expect(computePairStatus([])).toBe("PENDING");
    });
});

// ── computeDifference / computeAverage ────────────────────────────────────────

describe("computeDifference และ computeAverage", () => {
    it("ทั้งสองมีคะแนน → difference = |g1 - g2|", () => {
        expect(computeDifference(9, 3)).toBe(6);
        expect(computeDifference(3, 9)).toBe(6);
        expect(computeDifference(5, 5)).toBe(0);
    });

    it("g1 เป็น null → difference = 0", () => {
        expect(computeDifference(null, 5)).toBe(0);
    });

    it("g2 เป็น null → difference = 0", () => {
        expect(computeDifference(5, null)).toBe(0);
    });

    it("ทั้งสองมีคะแนน → average = (g1 + g2) / 2", () => {
        expect(computeAverage(8, 8)).toBe(8);
        expect(computeAverage(9, 3)).toBe(6);
        expect(computeAverage(7, 8)).toBe(7.5);
    });

    it("g1 เป็น null → average = 0", () => {
        expect(computeAverage(null, 5)).toBe(0);
    });
});

// ── sortCases ─────────────────────────────────────────────────────────────────

describe("sortCases: เรียงลำดับ cases", () => {
    const cases = [
        makeCase({ bagNo: 3, questionNo: 2, difference: 5, randomNum: "10003" }),
        makeCase({ bagNo: 1, questionNo: 1, difference: 8, randomNum: "10001" }),
        makeCase({ bagNo: 2, questionNo: 3, difference: 2, randomNum: "10002" }),
    ];

    it("sortBy=bagNo asc → 1, 2, 3", () => {
        const sorted = sortCases(cases, "bagNo", "asc");
        expect(sorted.map((c) => c.bagNo)).toEqual([1, 2, 3]);
    });

    it("sortBy=bagNo desc → 3, 2, 1", () => {
        const sorted = sortCases(cases, "bagNo", "desc");
        expect(sorted.map((c) => c.bagNo)).toEqual([3, 2, 1]);
    });

    it("sortBy=questionNo asc → 1, 2, 3", () => {
        const sorted = sortCases(cases, "questionNo", "asc");
        expect(sorted.map((c) => c.questionNo)).toEqual([1, 2, 3]);
    });

    it("sortBy=difference desc → 8, 5, 2", () => {
        const sorted = sortCases(cases, "difference", "desc");
        expect(sorted.map((c) => c.difference)).toEqual([8, 5, 2]);
    });

    it("sortBy=randomNum asc → alphabetical order", () => {
        const sorted = sortCases(cases, "randomNum", "asc");
        expect(sorted.map((c) => c.randomNum)).toEqual(["10001", "10002", "10003"]);
    });
});

// ── filterCases ───────────────────────────────────────────────────────────────

describe("filterCases: กรองตามเงื่อนไข", () => {
    const cases = [
        makeCase({ caseId: "1_1", bagId: 10, questionId: 10, subjectId: 1, randomNum: "10001", questionLabel: "ข้อ 1 สัญญา" }),
        makeCase({ caseId: "2_2", bagId: 10, questionId: 11, subjectId: 2, randomNum: "10002", questionLabel: "ข้อ 2 อาญา" }),
        makeCase({ caseId: "3_1", bagId: 11, questionId: 10, subjectId: 1, randomNum: "10003", questionLabel: "ข้อ 1 สัญญา" }),
    ];

    it("กรอง bagId → เฉพาะ bag นั้น", () => {
        const result = filterCases(cases, { bagId: 11 });
        expect(result.length).toBe(1);
        expect(result[0]!.caseId).toBe("3_1");
    });

    it("กรอง sessionSubjectQuestionId", () => {
        const result = filterCases(cases, { sessionSubjectQuestionId: 11 });
        expect(result.length).toBe(1);
        expect(result[0]!.questionId).toBe(11);
    });

    it("กรอง subjectId", () => {
        const result = filterCases(cases, { subjectId: 1 });
        expect(result.length).toBe(2);
    });

    it("text search โดย randomNum", () => {
        const result = filterCases(cases, { search: "10002" });
        expect(result.length).toBe(1);
        expect(result[0]!.randomNum).toBe("10002");
    });

    it("text search โดย questionLabel (case-insensitive)", () => {
        const result = filterCases(cases, { search: "สัญญา" });
        expect(result.length).toBe(2);
    });

    it("ไม่มีเงื่อนไข → คืนทั้งหมด", () => {
        expect(filterCases(cases, {}).length).toBe(3);
    });

    it("เงื่อนไขไม่ตรงกับใคร → คืน empty", () => {
        expect(filterCases(cases, { bagId: 999 }).length).toBe(0);
    });
});

// ── paginateCases ─────────────────────────────────────────────────────────────

describe("paginateCases: แบ่งหน้า", () => {
    const cases = Array.from({ length: 25 }, (_, i) =>
        makeCase({ caseId: `${i}_1`, bookletId: i }),
    );

    it("page 1, limit 10 → 10 items", () => {
        const result = paginateCases(cases, 1, 10);
        expect(result.items.length).toBe(10);
        expect(result.total).toBe(25);
        expect(result.totalPages).toBe(3);
        expect(result.page).toBe(1);
    });

    it("page 3, limit 10 → 5 items (หน้าสุดท้าย)", () => {
        const result = paginateCases(cases, 3, 10);
        expect(result.items.length).toBe(5);
    });

    it("page 1, limit 25 → ทั้งหมด", () => {
        const result = paginateCases(cases, 1, 25);
        expect(result.items.length).toBe(25);
        expect(result.totalPages).toBe(1);
    });

    it("page เกิน total → items ว่าง", () => {
        const result = paginateCases(cases, 99, 10);
        expect(result.items.length).toBe(0);
    });

    it("totalPages คำนวณถูกต้อง (ceil)", () => {
        expect(paginateCases(Array.from({ length: 11 }, () => makeCase()), 1, 10).totalPages).toBe(2);
        expect(paginateCases(Array.from({ length: 10 }, () => makeCase()), 1, 10).totalPages).toBe(1);
        expect(paginateCases(Array.from({ length: 1 },  () => makeCase()), 1, 10).totalPages).toBe(1);
        expect(paginateCases([], 1, 10).totalPages).toBe(0);
    });
});

// ── computeCaseCount ──────────────────────────────────────────────────────────

describe("computeCaseCount: นับ cases ต่อถุง (หาร 2 เพราะ 2 slots ต่อ case)", () => {
    it("4 slots (2 cases) ในถุง → caseCount = 2", () => {
        const slots = [
            { booklet_id: 1 }, { booklet_id: 1 }, // case 1 (2 slots)
            { booklet_id: 2 }, { booklet_id: 2 }, // case 2 (2 slots)
        ];
        const booklets = [
            { id: 1, bag_id: 10 },
            { id: 2, bag_id: 10 },
        ];
        expect(computeCaseCount(slots, 10, booklets)).toBe(2);
    });

    it("ไม่มี slot ในถุงนั้น → 0", () => {
        const slots = [{ booklet_id: 1 }];
        const booklets = [{ id: 1, bag_id: 99 }];
        expect(computeCaseCount(slots, 10, booklets)).toBe(0);
    });

    it("ceil: slot เดี่ยว (กรณีข้อมูลไม่ครบคู่) → นับ 1", () => {
        const slots = [{ booklet_id: 1 }];
        const booklets = [{ id: 1, bag_id: 10 }];
        expect(computeCaseCount(slots, 10, booklets)).toBe(1);
    });
});
