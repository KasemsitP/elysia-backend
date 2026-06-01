/**
 * Unit tests: Threshold key consistency
 *
 * Verifies that all modules use the same settings key "reset_threshold"
 * (not the old "score_diff_threshold" that was misused before).
 *
 * This test reads source files to catch future regressions where someone
 * might accidentally revert to the old key.
 *
 * Run: bun test tests/unit/threshold-key-consistency.test.ts
 */
import { describe, it, expect } from "bun:test";
import { readFileSync } from "fs";
import { resolve } from "path";

function readSource(relPath: string): string {
    return readFileSync(resolve(relPath), "utf8");
}

describe("reset_threshold: ใช้ key เดียวกันทุก module", () => {
    it("grading.service ต้องใช้ reset_threshold ไม่ใช่ score_diff_threshold", () => {
        const src = readSource("src/modules/grading/grading.service.ts");
        expect(src).not.toContain("score_diff_threshold");
        expect(src).toContain("reset_threshold");
    });

    it("bag-score-report.service ต้องรับ differenceThreshold จาก caller (ไม่ hard-code)", () => {
        const src = readSource("src/modules/reports/bag-score-report.service.ts");
        // The service accepts threshold as a parameter, not hard-coded from settings
        expect(src).toContain("differenceThreshold");
    });

    it("score-reset.repo ต้องมี getThreshold ที่ใช้ reset_threshold key", () => {
        // score-reset determines DISPUTED at grading time (baked into slot.status).
        // The repo exposes getThreshold for summary display purposes.
        const src = readSource("src/modules/score-reset/score-reset.repo.ts");
        expect(src).toContain("getThreshold");
        expect(src).toContain("reset_threshold");
    });

    it("score-reset.repo ต้องดึง setting_key reset_threshold", () => {
        const src = readSource("src/modules/score-reset/score-reset.repo.ts");
        expect(src).toContain("reset_threshold");
        expect(src).not.toContain("score_diff_threshold");
    });

    it("ranking-report.repo ต้องรวม RESET slots (ไม่ใช่แค่ COMPLETED)", () => {
        const src = readSource("src/modules/reports/ranking-report.repo.ts");
        expect(src).toContain("RESET");
        expect(src).toContain("COMPLETED");
    });
});

describe("OPTIONAL question type: มีใน schema และ service", () => {
    it("bag-score-report.service ต้อง handle OPTIONAL → SKIPPED", () => {
        const src = readSource("src/modules/reports/bag-score-report.service.ts");
        expect(src).toContain("OPTIONAL");
        expect(src).toContain("SKIPPED");
    });

    it("bag-score-report.repo ต้อง select question_type", () => {
        const src = readSource("src/modules/reports/bag-score-report.repo.ts");
        expect(src).toContain("question_type");
    });

    it("session-subject-questions schema รองรับ OPTIONAL", () => {
        const src = readSource("src/modules/session-subject-questions/session-subject-questions.schema.ts");
        expect(src).toContain("OPTIONAL");
        expect(src).toContain("REQUIRED");
    });
});

describe("Score reset: audit log ต้องมีใน confirmReset", () => {
    it("score-reset.service ต้องสร้าง grading_score_logs หลัง reset", () => {
        const src = readSource("src/modules/score-reset/score-reset.service.ts");
        expect(src).toContain("grading_score_logs");
        expect(src).toContain("reason");
        expect(src).toContain("RESET");
    });

    it("score-reset.service ต้องอัพเดต grading_scores ตอน confirm", () => {
        const src = readSource("src/modules/score-reset/score-reset.service.ts");
        expect(src).toContain("grading_scores");
        expect(src).toContain("grader1Score");
        expect(src).toContain("grader2Score");
    });
});
