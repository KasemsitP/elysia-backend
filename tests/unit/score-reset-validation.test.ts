/**
 * Unit tests: Score reset validation logic
 *
 * Tests the score range validation and caseId parsing.
 * Replicates logic from score-reset.service.ts (confirmReset + parseCaseId).
 *
 * Run: bun test tests/unit/score-reset-validation.test.ts
 */
import { describe, it, expect } from "bun:test";

// ── Replicated from score-reset.service.ts ────────────────────────────────────

function parseCaseId(caseId: string): { bookletId: number; questionId: number } {
    const parts = caseId.split("_");
    if (parts.length !== 2) throw new Error("รูปแบบ caseId ไม่ถูกต้อง");
    const bookletId = Number(parts[0]);
    const questionId = Number(parts[1]);
    if (isNaN(bookletId) || isNaN(questionId)) throw new Error("รูปแบบ caseId ไม่ถูกต้อง");
    return { bookletId, questionId };
}

function validateResetScores(
    grader1Score: number,
    grader2Score: number,
    maxScore: number,
): void {
    if (grader1Score > maxScore) {
        throw new Error(`คะแนนผู้ตรวจ 1 ต้องไม่เกิน ${maxScore}`);
    }
    if (grader2Score > maxScore) {
        throw new Error(`คะแนนผู้ตรวจ 2 ต้องไม่เกิน ${maxScore}`);
    }
}

// ── parseCaseId tests ─────────────────────────────────────────────────────────

describe("parseCaseId: แปลง caseId string → { bookletId, questionId }", () => {
    it("parse รูปแบบปกติถูกต้อง", () => {
        const result = parseCaseId("100_1");
        expect(result.bookletId).toBe(100);
        expect(result.questionId).toBe(1);
    });

    it("parse ID ตัวเลขขนาดใหญ่ถูกต้อง", () => {
        const result = parseCaseId("99999_888");
        expect(result.bookletId).toBe(99999);
        expect(result.questionId).toBe(888);
    });

    it("caseId ที่ไม่มี underscore → throw", () => {
        expect(() => parseCaseId("100")).toThrow("รูปแบบ caseId ไม่ถูกต้อง");
    });

    it("caseId ที่มี underscore มากกว่า 1 ตัว → throw", () => {
        expect(() => parseCaseId("100_1_2")).toThrow("รูปแบบ caseId ไม่ถูกต้อง");
    });

    it("caseId ที่ส่วนใดส่วนหนึ่งไม่ใช่ตัวเลข → throw", () => {
        expect(() => parseCaseId("abc_1")).toThrow("รูปแบบ caseId ไม่ถูกต้อง");
    });

    it("caseId string ว่าง → throw", () => {
        expect(() => parseCaseId("")).toThrow();
    });
});

// ── validateResetScores tests ─────────────────────────────────────────────────

describe("validateResetScores: คะแนนต้องไม่เกิน maxScore", () => {
    it("คะแนนในช่วงที่ถูกต้อง ไม่ throw", () => {
        expect(() => validateResetScores(8, 8, 10)).not.toThrow();
        expect(() => validateResetScores(0, 0, 10)).not.toThrow();
        expect(() => validateResetScores(10, 10, 10)).not.toThrow();
    });

    it("grader1Score เกิน maxScore → throw พร้อมข้อความภาษาไทย", () => {
        expect(() => validateResetScores(11, 8, 10))
            .toThrow("คะแนนผู้ตรวจ 1 ต้องไม่เกิน 10");
    });

    it("grader2Score เกิน maxScore → throw พร้อมข้อความภาษาไทย", () => {
        expect(() => validateResetScores(8, 11, 10))
            .toThrow("คะแนนผู้ตรวจ 2 ต้องไม่เกิน 10");
    });

    it("ทั้งสองเกิน → throw เรื่อง grader1 ก่อน", () => {
        expect(() => validateResetScores(15, 12, 10))
            .toThrow("คะแนนผู้ตรวจ 1");
    });

    it("คะแนนเท่า maxScore พอดี → ผ่าน", () => {
        expect(() => validateResetScores(10, 10, 10)).not.toThrow();
    });
});

// ── Reset result calculation tests ───────────────────────────────────────────

describe("คำนวณค่าเฉลี่ยและผลต่างหลัง reset", () => {
    function computeResetResult(g1: number, g2: number) {
        return {
            averageScore: (g1 + g2) / 2,
            difference: Math.abs(g1 - g2),
        };
    }

    it("reset ด้วยคะแนนเท่ากัน → ผลต่าง 0", () => {
        const { averageScore, difference } = computeResetResult(8, 8);
        expect(averageScore).toBe(8);
        expect(difference).toBe(0);
    });

    it("reset ด้วยคะแนนใกล้เคียงกัน → ผลต่างน้อย", () => {
        const { averageScore, difference } = computeResetResult(9, 8);
        expect(averageScore).toBe(8.5);
        expect(difference).toBe(1);
    });

    it("คะแนน reset ต้องไม่มี NaN", () => {
        const { averageScore, difference } = computeResetResult(7, 7);
        expect(Number.isNaN(averageScore)).toBe(false);
        expect(Number.isNaN(difference)).toBe(false);
    });
});

// ── Duplicate reset prevention ────────────────────────────────────────────────

describe("ป้องกัน reset ซ้ำ: ตรวจสอบ allReset flag", () => {
    function isAlreadyReset(slots: Array<{ status: string }>): boolean {
        return slots.length > 0 && slots.every((s) => s.status === "RESET");
    }

    it("slots ทั้งหมดเป็น RESET → ถือว่า reset แล้ว", () => {
        expect(isAlreadyReset([{ status: "RESET" }, { status: "RESET" }])).toBe(true);
    });

    it("slots บางตัวยัง DISPUTED → ยังไม่ reset", () => {
        expect(isAlreadyReset([{ status: "RESET" }, { status: "DISPUTED" }])).toBe(false);
    });

    it("slots ว่าง → ไม่ถือว่า reset แล้ว", () => {
        expect(isAlreadyReset([])).toBe(false);
    });

    it("slots เป็น COMPLETED → ไม่ถือว่า reset แล้ว", () => {
        expect(isAlreadyReset([{ status: "COMPLETED" }, { status: "COMPLETED" }])).toBe(false);
    });
});
