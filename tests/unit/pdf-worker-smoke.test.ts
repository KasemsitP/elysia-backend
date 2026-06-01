/**
 * Phase 3B — PDF worker smoke tests
 *
 * Tests that runPdfWorker spawns a worker correctly and returns a non-empty Buffer.
 * Uses "bag-score-report" type (text-based, no PDFKit needed) for reliability.
 * Tests "ranking-report" type (PDFKit) only if fonts exist.
 *
 * Run: bun test tests/unit/pdf-worker-smoke.test.ts
 */
import { describe, it, expect } from "bun:test";
import { existsSync } from "fs";
import { resolve } from "path";

// Minimal BagScoreReportData for the text-based generator
const minimalBagReportData = {
    campaign: { id: 1, name: "Test Campaign", yearBe: "2568", campaignSize: "สนามใหญ่", isUnlock: false },
    bag: { bagId: 1, bagNo: 1, sessionCode: "D1", sessionTitle: "วันที่ 1", bookletCount: 2, subjectNames: ["กฎหมายอาญา"] },
    summary: { questionCount: 2, bookletCount: 2, completedCount: 1, maxScore: 20 },
    questions: [
        { questionNo: 1, questionLabel: "ข้อ 1", subjectName: "กฎหมายอาญา", maxScore: 10 },
        { questionNo: 2, questionLabel: "ข้อ 2", subjectName: "กฎหมายอาญา", maxScore: 10 },
    ],
    rows: [
        {
            displayCode: "10001",
            scores: [
                { questionNo: 1, grader1Score: 8, grader2Score: 6, difference: 2, finalScore: 7, hasDifference: false, status: "COMPLETE" },
                { questionNo: 2, grader1Score: null, grader2Score: null, difference: null, finalScore: null, hasDifference: false, status: "SKIPPED" },
            ],
            totalScore: 7,
            status: "COMPLETE",
        },
    ],
};

const minimalAllBagsData = {
    campaign: { id: 1, name: "Test Campaign" },
    bags: [minimalBagReportData],
};

// Minimal RankingReportData for the PDFKit generator
const minimalRankingData = {
    campaign: { id: 1, name: "Test Campaign", yearBe: "2568", campaignSize: "สนามใหญ่", site: "Test Site" },
    passingCount: 3,
    rankingSubjectIds: [1],
    subjectNames: { 1: "กฎหมายอาญา" } as Record<number, string>,
    rows: [
        {
            rank: 1,
            bookletId: 100,
            userCode: "U001",
            title: "นาย",
            fullName: "สมชาย ใจดี",
            totalScore: 75,
            subjectScores: { 1: 75 } as Record<number, number>,
        },
    ],
};

const FONTS_EXIST = existsSync(resolve("fonts/THSarabunNew.ttf"));

describe("PDF worker: bag-score-report (text-based, ไม่ต้องใช้ font)", () => {
    it("ส่งคืน Buffer ที่ไม่ว่าง", async () => {
        const { runPdfWorker } = await import("../../src/cores/pdf-runner");
        const buffer = await runPdfWorker("bag-score-report", minimalBagReportData);
        expect(buffer).toBeInstanceOf(Buffer);
        expect(buffer.length).toBeGreaterThan(0);
    }, 15_000);

    it("buffer มีเนื้อหาที่ถูกต้อง (ชื่อถุง)", async () => {
        const { runPdfWorker } = await import("../../src/cores/pdf-runner");
        const buffer = await runPdfWorker("bag-score-report", minimalBagReportData);
        const text = buffer.toString("utf8");
        expect(text).toContain("ถุงที่ 1");
    }, 15_000);

    it("bag-score-report-all ส่งคืน Buffer หลายถุง", async () => {
        const { runPdfWorker } = await import("../../src/cores/pdf-runner");
        const buffer = await runPdfWorker("bag-score-report-all", minimalAllBagsData);
        expect(buffer).toBeInstanceOf(Buffer);
        expect(buffer.length).toBeGreaterThan(0);
    }, 15_000);

    it("bag-score-report-all buffer มีชื่อถุง", async () => {
        const { runPdfWorker } = await import("../../src/cores/pdf-runner");
        const buffer = await runPdfWorker("bag-score-report-all", minimalAllBagsData);
        const text = buffer.toString("utf8");
        expect(text).toContain("ถุงที่ 1");
    }, 15_000);
});

describe("PDF worker: ranking-report (PDFKit)", () => {
    if (!FONTS_EXIST) {
        it.skip("ข้ามเพราะไม่พบ font THSarabunNew.ttf", () => {});
        return;
    }

    it("ส่งคืน PDF Buffer (binary, ขึ้นต้นด้วย %PDF)", async () => {
        const { runPdfWorker } = await import("../../src/cores/pdf-runner");
        const buffer = await runPdfWorker("ranking-report", minimalRankingData);
        expect(buffer).toBeInstanceOf(Buffer);
        expect(buffer.length).toBeGreaterThan(100);
        // PDF files start with %PDF
        expect(buffer.subarray(0, 4).toString("ascii")).toBe("%PDF");
    }, 20_000);
});

describe("PDF worker: job type ไม่ถูกต้อง", () => {
    it("job type ไม่รู้จัก → throw error ไม่ crash ระบบ", async () => {
        const { runPdfWorker } = await import("../../src/cores/pdf-runner");
        await expect(
            runPdfWorker("unknown-type" as never, {}),
        ).rejects.toThrow();
    }, 15_000);
});
