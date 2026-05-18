/**
 * PDF Worker Thread
 *
 * ทำงานใน worker_threads เพื่อไม่บล็อก event loop
 * ติดตั้ง: bun add pdfkit @types/pdfkit
 *
 * รับ: workerData = { type: PdfJobType, data: any, locale: "th" }
 * ส่งกลับ: Buffer (PDF binary) ผ่าน parentPort.postMessage
 */
import { workerData, parentPort, isMainThread } from "worker_threads";
// import PDFDocument from "pdfkit";  // uncomment เมื่อ install แล้ว

if (isMainThread) {
    throw new Error("pdf.worker.ts ต้องรันใน worker thread เท่านั้น");
}

type PdfJobType =
    | "bag-scores"
    | "bag-manual-score-sheet"
    | "campaign-score-summary"
    | "passing-list"
    | "grader-workload";

interface PdfJob {
    type: PdfJobType;
    data: unknown;
}

async function generatePdf(job: PdfJob): Promise<Buffer> {
    // เมื่อ install PDFKit แล้ว:
    // const doc = new PDFDocument({ size: "A4", margin: 40, lang: "th" });
    // doc.registerFont("THSarabunNew", "fonts/THSarabunNew.ttf");
    // doc.font("THSarabunNew").fontSize(14);

    switch (job.type) {
        case "bag-scores":
            return generateBagScoresPdf(job.data as BagScoresData);
        case "bag-manual-score-sheet":
            return generateManualScoreSheetPdf(job.data as BagScoresData);
        case "passing-list":
            return generatePassingListPdf(job.data as PassingListData);
        default:
            throw new Error(`Unknown PDF type: ${job.type}`);
    }
}

// ── PDF Template Types ─────────────────────────────────────────────────────────

interface BagScoresData {
    bag_no: number;
    campaign_unlocked: boolean;
    booklets: Array<{
        identifier: string;
        questions: Array<{
            question_no: number;
            label: string;
            max_score: number;
            grader1: number | null;
            grader2: number | null;
            status: string;
        }>;
    }>;
}

interface PassingListData {
    campaign_id: number;
    passing_policy: string;
    candidates: Array<{ rank: number; identifier: string; total_score: number; passed: boolean }>;
}

// ── PDF Generators ─────────────────────────────────────────────────────────────

function generateBagScoresPdf(data: BagScoresData): Buffer {
    // TODO: ใช้ PDFKit สร้าง PDF จริง
    // ตอนนี้ return placeholder buffer
    const content = [
        `รายงานคะแนนถุงที่ ${data.bag_no}`,
        `สถานะ: ${data.campaign_unlocked ? "Unlocked" : "Locked"}`,
        "",
        ...data.booklets.map((b) =>
            `เล่ม ${b.identifier}: ${b.questions.map((q) => `ข้อ${q.question_no}=${q.grader1 ?? "-"}`).join(", ")}`,
        ),
    ].join("\n");
    return Buffer.from(content, "utf8");
}

function generateManualScoreSheetPdf(data: BagScoresData): Buffer {
    const content = [
        `ใบกรอกคะแนน ถุงที่ ${data.bag_no}`,
        "",
        ...data.booklets.flatMap((b) =>
            b.questions.map((q) => `${b.identifier} | ข้อ ${q.question_no} | max: ${q.max_score} | คะแนน: ___`),
        ),
    ].join("\n");
    return Buffer.from(content, "utf8");
}

function generatePassingListPdf(data: PassingListData): Buffer {
    const content = [
        `รายชื่อผู้ผ่าน campaign ${data.campaign_id} (${data.passing_policy})`,
        "",
        ...data.candidates.map((c) => `${c.rank}. ${c.identifier} — ${c.total_score} คะแนน ${c.passed ? "✓" : "✗"}`),
    ].join("\n");
    return Buffer.from(content, "utf8");
}

// ── Main ───────────────────────────────────────────────────────────────────────

(async () => {
    try {
        const buffer = await generatePdf(workerData as PdfJob);
        // ส่งเป็น Uint8Array เพื่อ serialize ผ่าน structured clone
        parentPort!.postMessage({ success: true, buffer: new Uint8Array(buffer) });
    } catch (err) {
        parentPort!.postMessage({ success: false, error: String(err) });
    }
})();
