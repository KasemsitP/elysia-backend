/**
 * Unit tests: Row-level status and total score logic
 *
 * Replicates the row aggregation logic from bag-score-report.service.ts.
 *
 * Run: bun test tests/unit/bag-score-row-logic.test.ts
 */
import { describe, it, expect } from "bun:test";

// ── Replicated from bag-score-report.service.ts ────────────────────────────────

type CellStatus = "COMPLETE" | "PARTIAL" | "MISSING" | "SKIPPED";
type RowStatus = "COMPLETE" | "PARTIAL" | "MISSING";

interface Cell {
    questionType: "REQUIRED" | "OPTIONAL";
    status: CellStatus;
    finalScore: number | null;
    hasDifference: boolean;
}

function computeRow(cells: Cell[]): {
    rowStatus: RowStatus;
    totalScore: number | null;
    allEffectiveDone: boolean;
    hasMissingRequired: boolean;
    differenceCount: number;
} {
    const hasMissingRequired = cells.some(
        (s) => s.questionType === "REQUIRED" && (s.status === "MISSING" || s.status === "PARTIAL"),
    );
    const allEffectiveDone = cells.every((s) => s.status === "COMPLETE" || s.status === "SKIPPED");
    const hasAnyScore = cells.some((s) => s.finalScore !== null);
    const totalScore = cells.reduce((sum, s) => sum + (s.finalScore ?? 0), 0);
    const differenceCount = cells.filter((s) => s.hasDifference).length;

    const rowStatus: RowStatus =
        allEffectiveDone ? "COMPLETE"
        : hasMissingRequired && !hasAnyScore ? "MISSING"
        : "PARTIAL";

    return {
        rowStatus,
        totalScore: hasAnyScore ? Math.round(totalScore * 100) / 100 : null,
        allEffectiveDone,
        hasMissingRequired,
        differenceCount,
    };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Row ที่ทุกข้อ COMPLETE → rowStatus COMPLETE", () => {
    it("สองข้อบังคับ ครบ → COMPLETE", () => {
        const cells: Cell[] = [
            { questionType: "REQUIRED", status: "COMPLETE", finalScore: 8, hasDifference: false },
            { questionType: "REQUIRED", status: "COMPLETE", finalScore: 6, hasDifference: false },
        ];
        const row = computeRow(cells);
        expect(row.rowStatus).toBe("COMPLETE");
        expect(row.totalScore).toBe(14);
    });

    it("COMPLETE + SKIPPED → rowStatus COMPLETE (SKIPPED ไม่นับเป็น missing)", () => {
        const cells: Cell[] = [
            { questionType: "REQUIRED", status: "COMPLETE", finalScore: 9, hasDifference: false },
            { questionType: "OPTIONAL", status: "SKIPPED", finalScore: null, hasDifference: false },
        ];
        const row = computeRow(cells);
        expect(row.rowStatus).toBe("COMPLETE");
        expect(row.totalScore).toBe(9); // SKIPPED ไม่นับ
    });

    it("SKIPPED ทุกข้อ OPTIONAL → rowStatus COMPLETE, totalScore null", () => {
        const cells: Cell[] = [
            { questionType: "OPTIONAL", status: "SKIPPED", finalScore: null, hasDifference: false },
            { questionType: "OPTIONAL", status: "SKIPPED", finalScore: null, hasDifference: false },
        ];
        const row = computeRow(cells);
        expect(row.rowStatus).toBe("COMPLETE");
        expect(row.totalScore).toBeNull(); // ไม่มีคะแนนจริงเลย
    });
});

describe("Row ที่มี PARTIAL → rowStatus PARTIAL", () => {
    it("COMPLETE + PARTIAL → PARTIAL", () => {
        const cells: Cell[] = [
            { questionType: "REQUIRED", status: "COMPLETE", finalScore: 8, hasDifference: false },
            { questionType: "REQUIRED", status: "PARTIAL", finalScore: 5, hasDifference: false },
        ];
        const row = computeRow(cells);
        expect(row.rowStatus).toBe("PARTIAL");
    });

    it("คะแนนรวมนับเฉพาะ finalScore ที่มีค่า", () => {
        const cells: Cell[] = [
            { questionType: "REQUIRED", status: "COMPLETE", finalScore: 7.5, hasDifference: false },
            { questionType: "REQUIRED", status: "PARTIAL", finalScore: 3, hasDifference: false },
            { questionType: "OPTIONAL", status: "SKIPPED", finalScore: null, hasDifference: false },
        ];
        const row = computeRow(cells);
        expect(row.totalScore).toBe(10.5);
    });
});

describe("Row ที่มี MISSING REQUIRED → rowStatus MISSING", () => {
    it("ข้อบังคับขาดคะแนน ไม่มีคะแนนใดเลย → MISSING", () => {
        const cells: Cell[] = [
            { questionType: "REQUIRED", status: "MISSING", finalScore: null, hasDifference: false },
            { questionType: "REQUIRED", status: "MISSING", finalScore: null, hasDifference: false },
        ];
        const row = computeRow(cells);
        expect(row.rowStatus).toBe("MISSING");
        expect(row.totalScore).toBeNull();
    });

    it("MISSING REQUIRED + COMPLETE required → PARTIAL (มีบางส่วน)", () => {
        const cells: Cell[] = [
            { questionType: "REQUIRED", status: "COMPLETE", finalScore: 8, hasDifference: false },
            { questionType: "REQUIRED", status: "MISSING", finalScore: null, hasDifference: false },
        ];
        const row = computeRow(cells);
        // hasAnyScore = true เพราะข้อแรกมีคะแนน → PARTIAL ไม่ใช่ MISSING
        expect(row.rowStatus).toBe("PARTIAL");
    });
});

describe("DifferenceCount นับเฉพาะ cell ที่มี hasDifference = true", () => {
    it("นับจำนวน cell ที่เกิน threshold", () => {
        const cells: Cell[] = [
            { questionType: "REQUIRED", status: "COMPLETE", finalScore: 6, hasDifference: true },
            { questionType: "REQUIRED", status: "COMPLETE", finalScore: 8, hasDifference: false },
            { questionType: "OPTIONAL", status: "SKIPPED", finalScore: null, hasDifference: false },
        ];
        const row = computeRow(cells);
        expect(row.differenceCount).toBe(1);
    });

    it("SKIPPED optional ไม่นับเป็น hasDifference", () => {
        const cells: Cell[] = [
            { questionType: "OPTIONAL", status: "SKIPPED", finalScore: null, hasDifference: false },
        ];
        const row = computeRow(cells);
        expect(row.differenceCount).toBe(0);
    });
});

describe("คะแนนรวม (totalScore) ต้องไม่มี NaN หรือ undefined", () => {
    it("ทุก cell เป็น SKIPPED → totalScore null ไม่ใช่ NaN", () => {
        const cells: Cell[] = [
            { questionType: "OPTIONAL", status: "SKIPPED", finalScore: null, hasDifference: false },
        ];
        const row = computeRow(cells);
        expect(row.totalScore).toBeNull();
        expect(Number.isNaN(row.totalScore)).toBe(false);
    });

    it("ทุก cell เป็น MISSING → totalScore null ไม่ใช่ 0", () => {
        const cells: Cell[] = [
            { questionType: "REQUIRED", status: "MISSING", finalScore: null, hasDifference: false },
        ];
        const row = computeRow(cells);
        expect(row.totalScore).toBeNull();
    });
});
