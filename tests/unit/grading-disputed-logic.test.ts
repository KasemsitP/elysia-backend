/**
 * Unit tests: Grading disputed logic, draft validation, SCORE_NOT_SET sentinel
 *
 * Replicates pure decision logic from src/modules/grading/grading.service.ts:
 *   - isDisputed: Math.abs(s0 - s1) > threshold
 *   - SCORE_NOT_SET sentinel (-1) handling
 *   - score range validation (0 ≤ score ≤ maxScore)
 *   - randomNumRange string from booklets array
 *   - previewStart canStart logic
 *
 * Run: bun test tests/unit/grading-disputed-logic.test.ts
 */
import { describe, it, expect } from "bun:test";

// ── Replicated from grading.service.ts ────────────────────────────────────────

const SCORE_NOT_SET = -1;

function isDisputed(score0: number, score1: number, threshold: number): boolean {
    return Math.abs(score0 - score1) > threshold;
}

function isUnscoredDraft(score: number): boolean {
    return score === SCORE_NOT_SET || score < 0;
}

function validateScoreRange(score: number, maxScore: number): string | null {
    if (score < 0) return "คะแนนต้องไม่ติดลบ";
    if (score > maxScore) return `คะแนนต้องไม่เกิน ${maxScore}`;
    return null;
}

function computeRandomNumRange(booklets: Array<{ random_num: string | null }>): string {
    const nums = booklets.map((b) => b.random_num ?? "").filter(Boolean);
    if (nums.length === 0) return "";
    if (nums.length === 1) return nums[0]!;
    return `${nums[0]} - ${nums[nums.length - 1]}`;
}

function resolveCanStart(existingSlotsCount: number, mySlotExists: boolean): {
    canStart: boolean;
    reason: string;
} {
    if (mySlotExists) {
        return { canStart: true, reason: "มี slot อยู่แล้ว สามารถตรวจต่อได้" };
    }
    if (existingSlotsCount === 0) {
        return { canStart: true, reason: "จะเป็นผู้ตรวจคนที่ 1" };
    }
    if (existingSlotsCount === 1) {
        return { canStart: true, reason: "จะเป็นผู้ตรวจคนที่ 2" };
    }
    return { canStart: false, reason: "มีผู้ตรวจครบ 2 คนแล้ว" };
}

function mapDraftScore(score: number): number | null {
    return score === SCORE_NOT_SET ? null : score;
}

// ── isDisputed ─────────────────────────────────────────────────────────────────

describe("isDisputed: ตรวจสอบผลต่างเกิน threshold", () => {
    it("ผลต่าง > threshold → true (DISPUTED)", () => {
        expect(isDisputed(9, 3, 3)).toBe(true);   // |9-3|=6 > 3
        expect(isDisputed(10, 4, 3)).toBe(true);  // |10-4|=6 > 3
    });

    it("ผลต่าง = threshold พอดี → false (ไม่ DISPUTED)", () => {
        expect(isDisputed(6, 3, 3)).toBe(false);  // |6-3|=3, strictly > 3 is false
        expect(isDisputed(10, 7, 3)).toBe(false);
    });

    it("ผลต่าง < threshold → false", () => {
        expect(isDisputed(8, 7, 3)).toBe(false);  // |8-7|=1 < 3
        expect(isDisputed(5, 5, 3)).toBe(false);  // |5-5|=0 < 3
    });

    it("คะแนนเท่ากัน → false", () => {
        expect(isDisputed(7, 7, 3)).toBe(false);
        expect(isDisputed(0, 0, 0)).toBe(false);
    });

    it("threshold=0 → ผลต่างใดๆ > 0 = DISPUTED", () => {
        expect(isDisputed(8, 7, 0)).toBe(true);
        expect(isDisputed(5, 5, 0)).toBe(false);
    });

    it("ลำดับ score ไม่สำคัญ (absolute value)", () => {
        expect(isDisputed(3, 9, 3)).toBe(true);  // เหมือน isDisputed(9,3,3)
        expect(isDisputed(9, 3, 3)).toBe(true);
    });
});

// ── SCORE_NOT_SET sentinel ─────────────────────────────────────────────────────

describe("SCORE_NOT_SET sentinel (-1): ตรวจ draft ที่ยังไม่ได้ใส่คะแนน", () => {
    it("score = -1 → ถือว่ายังไม่ได้ใส่คะแนน", () => {
        expect(isUnscoredDraft(SCORE_NOT_SET)).toBe(true);
    });

    it("score = 0 → ถือว่ากรอกแล้ว (0 คือคะแนนที่ valid)", () => {
        expect(isUnscoredDraft(0)).toBe(false);
    });

    it("score = 5 → กรอกแล้ว", () => {
        expect(isUnscoredDraft(5)).toBe(false);
    });

    it("score < -1 → ถือว่า unscored (negative)", () => {
        expect(isUnscoredDraft(-2)).toBe(true);
    });

    it("mapDraftScore: -1 → null (แสดงในระบบ)", () => {
        expect(mapDraftScore(SCORE_NOT_SET)).toBeNull();
    });

    it("mapDraftScore: 0 → 0 (ไม่ map เป็น null)", () => {
        expect(mapDraftScore(0)).toBe(0);
    });

    it("mapDraftScore: 7 → 7", () => {
        expect(mapDraftScore(7)).toBe(7);
    });
});

// ── validateScoreRange ─────────────────────────────────────────────────────────

describe("validateScoreRange: ตรวจ range คะแนน", () => {
    it("score อยู่ในช่วง → ไม่มี error", () => {
        expect(validateScoreRange(0, 10)).toBeNull();
        expect(validateScoreRange(5, 10)).toBeNull();
        expect(validateScoreRange(10, 10)).toBeNull();
    });

    it("score < 0 → error ภาษาไทย", () => {
        expect(validateScoreRange(-1, 10)).toBe("คะแนนต้องไม่ติดลบ");
    });

    it("score > maxScore → error พร้อม maxScore", () => {
        expect(validateScoreRange(11, 10)).toBe("คะแนนต้องไม่เกิน 10");
        expect(validateScoreRange(100, 5)).toBe("คะแนนต้องไม่เกิน 5");
    });

    it("score = maxScore → ผ่าน (boundary)", () => {
        expect(validateScoreRange(10, 10)).toBeNull();
    });

    it("score = 0, maxScore = 0 → ผ่าน", () => {
        expect(validateScoreRange(0, 0)).toBeNull();
    });
});

// ── computeRandomNumRange ──────────────────────────────────────────────────────

describe("computeRandomNumRange: ช่วง random_num ของเล่มในถุง", () => {
    it("ว่าง → string ว่าง", () => {
        expect(computeRandomNumRange([])).toBe("");
    });

    it("เล่มเดียว → แค่หมายเลขนั้น", () => {
        expect(computeRandomNumRange([{ random_num: "10001" }])).toBe("10001");
    });

    it("หลายเล่ม → 'หมายเลขแรก - หมายเลขสุดท้าย'", () => {
        const booklets = [
            { random_num: "10001" },
            { random_num: "10002" },
            { random_num: "10003" },
        ];
        expect(computeRandomNumRange(booklets)).toBe("10001 - 10003");
    });

    it("random_num เป็น null → ข้าม", () => {
        const booklets = [
            { random_num: null },
            { random_num: "10002" },
            { random_num: null },
        ];
        expect(computeRandomNumRange(booklets)).toBe("10002");
    });

    it("ทั้งหมด null → string ว่าง", () => {
        expect(computeRandomNumRange([{ random_num: null }, { random_num: null }])).toBe("");
    });
});

// ── resolveCanStart ────────────────────────────────────────────────────────────

describe("resolveCanStart: ตรวจสอบว่า grader สามารถเริ่มตรวจได้หรือไม่", () => {
    it("มี slot อยู่แล้ว → canStart=true (resume)", () => {
        const result = resolveCanStart(1, true);
        expect(result.canStart).toBe(true);
        expect(result.reason).toContain("มี slot อยู่แล้ว");
    });

    it("ยังไม่มี slot ใด → canStart=true (เป็นคนที่ 1)", () => {
        const result = resolveCanStart(0, false);
        expect(result.canStart).toBe(true);
        expect(result.reason).toContain("คนที่ 1");
    });

    it("มี 1 slot (grader อื่น) → canStart=true (เป็นคนที่ 2)", () => {
        const result = resolveCanStart(1, false);
        expect(result.canStart).toBe(true);
        expect(result.reason).toContain("คนที่ 2");
    });

    it("มี 2 slots แล้ว → canStart=false", () => {
        const result = resolveCanStart(2, false);
        expect(result.canStart).toBe(false);
        expect(result.reason).toContain("ครบ 2 คน");
    });
});

// ── Disputed + threshold cross-check ──────────────────────────────────────────

describe("Disputed threshold กับ reset_threshold setting", () => {
    it("threshold=3: ผลต่าง 4 → DISPUTED", () => {
        expect(isDisputed(9, 5, 3)).toBe(true);
    });

    it("threshold=3: ผลต่าง 3 → ไม่ DISPUTED (strictly >)", () => {
        expect(isDisputed(9, 6, 3)).toBe(false);
    });

    it("threshold=5: ผลต่าง 5 → ไม่ DISPUTED", () => {
        expect(isDisputed(10, 5, 5)).toBe(false);
    });

    it("threshold=5: ผลต่าง 6 → DISPUTED", () => {
        expect(isDisputed(10, 4, 5)).toBe(true);
    });

    it("คะแนนหลัง reset ที่เท่ากัน → ไม่ DISPUTED ไม่ว่า threshold จะเป็นอะไร", () => {
        expect(isDisputed(8, 8, 3)).toBe(false);
        expect(isDisputed(0, 0, 0)).toBe(false);
    });
});
