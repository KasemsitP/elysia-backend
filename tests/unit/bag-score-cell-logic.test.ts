/**
 * Unit tests: Cell-level scoring logic
 *
 * Replicates the exact logic from bag-score-report.service.ts → computeScoreCell.
 * Tests the REQUIRED/OPTIONAL × score-presence matrix.
 *
 * Run: bun test tests/unit/bag-score-cell-logic.test.ts
 */
import { describe, it, expect } from "bun:test";

// ── Replicated from bag-score-report.service.ts (getBagScoreReport inner loop)
// If the production algorithm changes, update this copy too.

type Status = "COMPLETE" | "PARTIAL" | "MISSING" | "SKIPPED";

interface CellResult {
    status: Status;
    difference: number | null;
    averageScore: number | null;
    finalScore: number | null;
    hasDifference: boolean;
}

function computeCell(opts: {
    questionType: "REQUIRED" | "OPTIONAL";
    g1: number | null;
    g2: number | null;
    g1SlotExists?: boolean;
    g2SlotExists?: boolean;
    threshold?: number;
}): CellResult {
    const { questionType, threshold = 3 } = opts;
    const g1 = opts.g1;
    const g2 = opts.g2;
    const g1SlotExists = opts.g1SlotExists ?? g1 !== null;
    const g2SlotExists = opts.g2SlotExists ?? g2 !== null;

    const isOptional = questionType === "OPTIONAL";
    const hasBoth = g1 !== null && g2 !== null;
    const hasAny = g1 !== null || g2 !== null || g1SlotExists || g2SlotExists;

    let difference: number | null = null;
    let averageScore: number | null = null;
    let finalScore: number | null = null;
    let hasDifference = false;
    let status: Status;

    if (hasBoth) {
        difference = Math.round(Math.abs(g1! - g2!) * 100) / 100;
        averageScore = Math.round(((g1! + g2!) / 2) * 100) / 100;
        finalScore = averageScore;
        hasDifference = difference > threshold;
        status = "COMPLETE";
    } else if (hasAny) {
        finalScore = g1 ?? g2;
        status = "PARTIAL";
    } else if (isOptional) {
        status = "SKIPPED";
    } else {
        status = "MISSING";
    }

    return { status, difference, averageScore, finalScore, hasDifference };
}

// ── REQUIRED question tests ────────────────────────────────────────────────────

describe("REQUIRED + ทั้ง 2 คะแนน = COMPLETE", () => {
    it("คำนวณผลต่างและค่าเฉลี่ยถูกต้อง", () => {
        const cell = computeCell({ questionType: "REQUIRED", g1: 9, g2: 3, threshold: 3 });
        expect(cell.status).toBe("COMPLETE");
        expect(cell.difference).toBe(6);
        expect(cell.averageScore).toBe(6);
        expect(cell.finalScore).toBe(6);
    });

    it("hasDifference = true เมื่อผลต่าง > threshold", () => {
        const cell = computeCell({ questionType: "REQUIRED", g1: 9, g2: 3, threshold: 3 });
        expect(cell.hasDifference).toBe(true);
    });

    it("hasDifference = false เมื่อผลต่าง = threshold พอดี", () => {
        // threshold is strictly > so diff==threshold is NOT a difference
        const cell = computeCell({ questionType: "REQUIRED", g1: 6, g2: 3, threshold: 3 });
        expect(cell.difference).toBe(3);
        expect(cell.hasDifference).toBe(false);
    });

    it("hasDifference = false เมื่อผลต่าง < threshold", () => {
        const cell = computeCell({ questionType: "REQUIRED", g1: 8, g2: 7, threshold: 3 });
        expect(cell.difference).toBe(1);
        expect(cell.hasDifference).toBe(false);
    });

    it("ค่าเฉลี่ยที่มีทศนิยมถูก round ถูกต้อง", () => {
        const cell = computeCell({ questionType: "REQUIRED", g1: 9, g2: 10, threshold: 3 });
        expect(cell.averageScore).toBe(9.5);
        expect(cell.finalScore).toBe(9.5);
    });

    it("คะแนนเท่ากัน ผลต่าง = 0, hasDifference = false", () => {
        const cell = computeCell({ questionType: "REQUIRED", g1: 8, g2: 8, threshold: 3 });
        expect(cell.difference).toBe(0);
        expect(cell.hasDifference).toBe(false);
        expect(cell.status).toBe("COMPLETE");
    });
});

describe("REQUIRED + มีคะแนนเดียว = PARTIAL", () => {
    it("มีแค่ผู้ตรวจ 1 → PARTIAL, finalScore = คะแนน g1", () => {
        const cell = computeCell({ questionType: "REQUIRED", g1: 7, g2: null, threshold: 3 });
        expect(cell.status).toBe("PARTIAL");
        expect(cell.finalScore).toBe(7);
        expect(cell.difference).toBeNull();
        expect(cell.averageScore).toBeNull();
    });

    it("มีแค่ผู้ตรวจ 2 → PARTIAL, finalScore = คะแนน g2", () => {
        const cell = computeCell({ questionType: "REQUIRED", g1: null, g2: 5, threshold: 3 });
        expect(cell.status).toBe("PARTIAL");
        expect(cell.finalScore).toBe(5);
    });

    it("slot มีอยู่แต่ยังไม่มีคะแนน → PARTIAL ไม่ใช่ MISSING", () => {
        const cell = computeCell({
            questionType: "REQUIRED",
            g1: null, g2: null,
            g1SlotExists: true, g2SlotExists: false,
            threshold: 3,
        });
        expect(cell.status).toBe("PARTIAL");
    });
});

describe("REQUIRED + ไม่มีคะแนนเลย = MISSING", () => {
    it("ไม่มี slot ใด → MISSING", () => {
        const cell = computeCell({
            questionType: "REQUIRED",
            g1: null, g2: null,
            g1SlotExists: false, g2SlotExists: false,
            threshold: 3,
        });
        expect(cell.status).toBe("MISSING");
        expect(cell.finalScore).toBeNull();
    });
});

// ── OPTIONAL question tests ───────────────────────────────────────────────────

describe("OPTIONAL + ทั้ง 2 คะแนน = COMPLETE (นับปกติ)", () => {
    it("คำนวณเหมือน REQUIRED เมื่อมีคะแนนครบ", () => {
        const cell = computeCell({ questionType: "OPTIONAL", g1: 8, g2: 8, threshold: 3 });
        expect(cell.status).toBe("COMPLETE");
        expect(cell.finalScore).toBe(8);
        expect(cell.hasDifference).toBe(false);
    });

    it("hasDifference = true เมื่อผลต่างเกิน threshold แม้จะเป็น OPTIONAL", () => {
        const cell = computeCell({ questionType: "OPTIONAL", g1: 10, g2: 4, threshold: 3 });
        expect(cell.status).toBe("COMPLETE");
        expect(cell.difference).toBe(6);
        expect(cell.hasDifference).toBe(true);
    });
});

describe("OPTIONAL + มีคะแนนเดียว = PARTIAL", () => {
    it("มีแค่ผู้ตรวจ 1 → PARTIAL ไม่ใช่ SKIPPED", () => {
        const cell = computeCell({ questionType: "OPTIONAL", g1: 6, g2: null, threshold: 3 });
        expect(cell.status).toBe("PARTIAL");
        expect(cell.finalScore).toBe(6);
    });
});

describe("OPTIONAL + ไม่มีคะแนนเลย = SKIPPED (ไม่ใช่ MISSING)", () => {
    it("ไม่มี slot ใด → SKIPPED", () => {
        const cell = computeCell({
            questionType: "OPTIONAL",
            g1: null, g2: null,
            g1SlotExists: false, g2SlotExists: false,
            threshold: 3,
        });
        expect(cell.status).toBe("SKIPPED");
        expect(cell.finalScore).toBeNull();
        expect(cell.difference).toBeNull();
        expect(cell.hasDifference).toBe(false);
    });

    it("SKIPPED ต้องไม่มี finalScore เพื่อไม่นับในคะแนนรวม", () => {
        const cell = computeCell({ questionType: "OPTIONAL", g1: null, g2: null, threshold: 3 });
        expect(cell.finalScore).toBeNull();
    });
});
