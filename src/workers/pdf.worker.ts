/**
 * PDF Worker Thread — ทำงานใน worker_threads เพื่อไม่บล็อก event loop
 * รับ: workerData = { type: PdfJobType, data: any }
 * ส่งกลับ: Uint8Array ผ่าน parentPort.postMessage
 */
import { workerData, parentPort, isMainThread } from "worker_threads";
import PDFDocument from "pdfkit";
import path from "path";
import type { RankingReportData } from "../modules/reports/ranking-report.service";

if (isMainThread) {
    throw new Error("pdf.worker.ts ต้องรันใน worker thread เท่านั้น");
}

const FONT_NORMAL = path.resolve(import.meta.dir, "../../fonts/THSarabunNew.ttf");
const FONT_BOLD   = path.resolve(import.meta.dir, "../../fonts/THSarabunNew-Bold.ttf");

type PdfJobType =
    | "bag-scores"
    | "bag-manual-score-sheet"
    | "campaign-score-summary"
    | "passing-list"
    | "grader-workload"
    | "bag-score-report"
    | "bag-score-report-all"
    | "ranking-report";

interface PdfJob {
    type: PdfJobType;
    data: unknown;
}

async function generatePdf(job: PdfJob): Promise<Buffer> {
    switch (job.type) {
        case "bag-scores":
            return generateBagScoresPdf(job.data as BagScoresData);
        case "bag-manual-score-sheet":
            return generateManualScoreSheetPdf(job.data as BagScoresData);
        case "passing-list":
            return generatePassingListPdf(job.data as PassingListData);
        case "bag-score-report":
            return generateBagScoreReportPdf(job.data as BagScoreReportData);
        case "bag-score-report-all":
            return generateAllBagScoreReportPdf(job.data as AllBagScoreReportData);
        case "ranking-report":
            return generateRankingPdf(job.data as RankingReportData);
        default:
            throw new Error(`Unknown PDF type: ${job.type}`);
    }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmt(v: number | null | undefined): string {
    if (v == null) return "";
    return Number.isInteger(v) ? String(v) : v.toFixed(2);
}

function pdfBuffer(doc: PDFKit.PDFDocument): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        doc.on("data", (c: Buffer) => chunks.push(c));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);
    });
}

// ── Ranking PDF (บัญชีรายชื่อเรียงลำดับคะแนน) ─────────────────────────────────

async function generateRankingPdf(data: RankingReportData): Promise<Buffer> {
    const doc = new PDFDocument({
        size: "A4",
        margins: { top: 40, bottom: 40, left: 40, right: 40 },
        autoFirstPage: true,
        bufferPages: false,
    });

    const bufPromise = pdfBuffer(doc);

    doc.registerFont("th",     FONT_NORMAL);
    doc.registerFont("th-bold", FONT_BOLD);

    const { campaign, rows, rankingSubjectIds, subjectNames } = data;
    const pageW = doc.page.width - 80; // 40 margin each side
    const left  = 40;

    // ── Column widths ─────────────────────────────────────────────────────────
    const colW = [pageW * 0.10, pageW * 0.22, pageW * 0.48, pageW * 0.20];
    const headerH = 20, rowH = 18;

    function drawHeaderInfo() {
        doc.font("th-bold").fontSize(16)
            .text("บัญชีรายชื่อเรียงลำดับคะแนน", left, 40, { align: "center" });
        doc.font("th").fontSize(12)
            .text(
                `สนามสอบ: ${campaign.site ?? ""} (${campaign.campaignSize} พ.ศ.${campaign.yearBe})`,
                left, 62, { align: "center" },
            );
        return 88; // y after header block
    }

    function drawTableHeader(y: number) {
        const heads = ["ลำดับที่", "เลขประจำตัวสอบ", "ชื่อ-สกุล", "คะแนนรวม"];
        doc.font("th-bold").fontSize(12).lineWidth(0.7).strokeColor("black");
        let x = left;
        let p2 = doc.rect(left, y, pageW, headerH);
        for (let i = 1; i < colW.length; i++) {
            x += colW[i - 1]!;
            p2 = p2.moveTo(x, y).lineTo(x, y + headerH);
        }
        p2.stroke();
        x = left;
        heads.forEach((h, i) => {
            doc.text(h, x, y + 4, { width: colW[i]!, align: "center" });
            x += colW[i]!;
        });
        doc.font("th").fontSize(12);
        return y + headerH;
    }

    let y = drawHeaderInfo();
    y = drawTableHeader(y);

    for (let idx = 0; idx < rows.length; idx++) {
        const row = rows[idx]!;
        if (y + rowH > doc.page.height - 50) {
            doc.addPage();
            y = drawHeaderInfo();
            y = drawTableHeader(y);
        }

        let x = left;
        let pathRow = doc.rect(left, y, pageW, rowH);
        let xCur = left;
        for (let i = 1; i < colW.length; i++) {
            xCur += colW[i - 1]!;
            pathRow = pathRow.moveTo(xCur, y).lineTo(xCur, y + rowH);
        }
        pathRow.stroke();

        x = left;
        doc.text(String(row.rank),             x,     y + 3, { width: colW[0]!, align: "center" }); x += colW[0]!;
        doc.text(row.userCode ?? "-",           x,     y + 3, { width: colW[1]!, align: "center" }); x += colW[1]!;
        doc.text(`${row.title ? row.title + " " : ""}${row.fullName ?? "-"}`, x + 4, y + 3, { width: colW[2]! - 8, align: "left" }); x += colW[2]!;
        doc.text(fmt(row.totalScore),           x,     y + 3, { width: colW[3]!, align: "center" });

        y += rowH;
        if (idx % 200 === 0) await new Promise((res) => setTimeout(res, 0));
    }

    // ── Verification page (landscape) ─────────────────────────────────────────
    if (rankingSubjectIds.length > 0) {
        const PAGE_OPTS = {
            size: "A4" as const,
            layout: "landscape" as const,
            margins: { top: 40, bottom: 40, left: 40, right: 40 },
        };

        const groupHeaders = rankingSubjectIds.map((id) => subjectNames[id] ?? `วิชา #${id}`);
        const headers = ["ลำดับ", "รหัสประจำตัวสอบ", "ชื่อ-สกุล", ...groupHeaders, "รวม"];

        const wRank = 45, wExam = 80, wName = 200;

        function addVerificationPage() {
            doc.addPage(PAGE_OPTS);
            doc.font("th-bold").fontSize(14).text("ตารางตรวจสอบคะแนนตามกลุ่ม", 40, 40, { align: "center" });
        }

        function getBounds() {
            const pw = doc.page.width - 80;
            const ph = doc.page.height - doc.page.margins.bottom;
            const remaining = headers.length - 3;
            const wRest = (pw - wRank - wExam - wName) / remaining;
            const cols = [wRank, wExam, wName, ...Array(remaining).fill(wRest)];
            return { pw, ph, cols };
        }

        function drawVerifHeader(yv: number) {
            const { cols } = getBounds();
            doc.font("th-bold").fontSize(8).lineWidth(0.5);
            let xv = 40;
            headers.forEach((h, i) => {
                doc.rect(xv, yv, cols[i], 22).stroke();
                doc.text(h, xv + 2, yv + 6, { width: cols[i] - 4, align: "center", ellipsis: true });
                xv += cols[i];
            });
            return yv + 22;
        }

        addVerificationPage();
        let yv = 68;
        yv = drawVerifHeader(yv);
        doc.font("th").fontSize(8);

        for (let idx = 0; idx < rows.length; idx++) {
            const { ph, cols } = getBounds();
            if (yv + 16 > ph) {
                addVerificationPage();
                yv = 68;
                yv = drawVerifHeader(yv);
                doc.font("th").fontSize(8);
            }

            const vrow = rows[idx]!;
            const rowData = [
                String(vrow.rank),
                vrow.userCode ?? "-",
                `${vrow.title ? vrow.title + " " : ""}${vrow.fullName ?? "-"}`,
                ...rankingSubjectIds.map((id) => fmt(vrow.subjectScores[id] ?? null)),
                fmt(vrow.totalScore),
            ];

            let xv = 40;
            rowData.forEach((val, i) => {
                const cw = cols[i]!;
                doc.rect(xv, yv, cw, 16).stroke();
                doc.text(val, xv + (i === 2 ? 4 : 0), yv + 4, {
                    width: cw - (i === 2 ? 8 : 0),
                    align: i === 2 ? "left" : "center",
                    ellipsis: true,
                });
                xv += cw;
            });
            yv += 16;
            if (idx % 200 === 0) await new Promise((res) => setTimeout(res, 0));
        }
    }

    doc.end();
    return bufPromise;
}

// ── Existing text-based generators (placeholder) ───────────────────────────────

interface BagScoresData {
    bag_no: number;
    campaign_unlocked: boolean;
    booklets: Array<{ identifier: string; questions: Array<{ question_no: number; label: string; max_score: number; grader1: number | null; grader2: number | null; status: string }> }>;
}
interface PassingListData {
    campaign_id: number;
    passing_policy: string;
    candidates: Array<{ rank: number; identifier: string; total_score: number; passed: boolean }>;
}
interface BagScoreReportData {
    campaign: { id: number; name: string | null; yearBe: string; campaignSize: string; isUnlock: boolean };
    bag: { bagId: number; bagNo: number; sessionCode: string; sessionTitle: string | null; bookletCount: number; subjectNames: string[] };
    summary: { questionCount: number; bookletCount: number; completedCount: number; maxScore: number };
    questions: Array<{ questionNo: number; questionLabel: string; subjectName: string; maxScore: number }>;
    rows: Array<{ displayCode: string; scores: Array<{ questionNo: number; grader1Score: number | null; grader2Score: number | null; difference: number | null; finalScore: number | null; hasDifference: boolean; status: string }>; totalScore: number | null; status: string }>;
}
interface AllBagScoreReportData { campaign: { id: number; name: string | null }; bags: BagScoreReportData[] }

function generateBagScoresPdf(data: BagScoresData): Buffer {
    const content = [`รายงานคะแนนถุงที่ ${data.bag_no}`, `สถานะ: ${data.campaign_unlocked ? "Unlocked" : "Locked"}`, "",
        ...data.booklets.map((b) => `เล่ม ${b.identifier}: ${b.questions.map((q) => `ข้อ${q.question_no}=${q.grader1 ?? "-"}`).join(", ")}`),
    ].join("\n");
    return Buffer.from(content, "utf8");
}
function generateManualScoreSheetPdf(data: BagScoresData): Buffer {
    const content = [`ใบกรอกคะแนน ถุงที่ ${data.bag_no}`, "",
        ...data.booklets.flatMap((b) => b.questions.map((q) => `${b.identifier} | ข้อ ${q.question_no} | max: ${q.max_score} | คะแนน: ___`)),
    ].join("\n");
    return Buffer.from(content, "utf8");
}
function generatePassingListPdf(data: PassingListData): Buffer {
    const content = [`รายชื่อผู้ผ่าน campaign ${data.campaign_id} (${data.passing_policy})`, "",
        ...data.candidates.map((c) => `${c.rank}. ${c.identifier} — ${c.total_score} คะแนน ${c.passed ? "✓" : "✗"}`),
    ].join("\n");
    return Buffer.from(content, "utf8");
}
function generateBagScoreReportPdf(data: BagScoreReportData): Buffer {
    const lines = [`ใบสรุปคะแนนถุงที่ ${data.bag.bagNo}`, `รอบสอบ: ${data.campaign.name ?? "-"}  (${data.campaign.yearBe})`,
        `วันสอบ: ${data.bag.sessionTitle ?? data.bag.sessionCode}`, `จำนวนเล่ม: ${data.bag.bookletCount}`, `วิชา: ${data.bag.subjectNames.join(", ")}`, "",
        `คะแนนเต็มรวม: ${data.summary.maxScore} คะแนน`, `ตรวจครบ: ${data.summary.completedCount}/${data.summary.bookletCount} เล่ม`, "",
        ...data.rows.map((row) => `${row.displayCode}: ${row.scores.map((s) => `ข้อ${s.questionNo}=[${s.grader1Score ?? "-"}/${s.grader2Score ?? "-"}]`).join(" ")}  รวม=${row.totalScore ?? "-"}`),
    ];
    return Buffer.from(lines.join("\n"), "utf8");
}
function generateAllBagScoreReportPdf(data: AllBagScoreReportData): Buffer {
    const sections = data.bags.flatMap((bag) => [`\n=== ถุงที่ ${bag.bag.bagNo} ===`,
        ...bag.rows.map((row) => `  ${row.displayCode}: ${row.scores.map((s) => `ข้อ${s.questionNo}=${s.finalScore ?? "-"}`).join(" ")}  รวม=${row.totalScore ?? "-"}`),
    ]);
    return Buffer.from([`ใบสรุปคะแนนทั้งหมด — ${data.campaign.name ?? data.campaign.id}`, `จำนวนถุง: ${data.bags.length}`, ...sections].join("\n"), "utf8");
}

// ── Main ───────────────────────────────────────────────────────────────────────

(async () => {
    try {
        const buffer = await generatePdf(workerData as PdfJob);
        parentPort!.postMessage({ success: true, buffer: new Uint8Array(buffer) });
    } catch (err) {
        parentPort!.postMessage({ success: false, error: String(err) });
    }
})();
