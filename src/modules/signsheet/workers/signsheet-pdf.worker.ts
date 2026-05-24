import { parentPort, workerData, isMainThread } from "worker_threads";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import path from "path";
import fs from "fs";
import os from "os";
import type { SignsheetPdfWorkerData, SignsheetRow } from "../signsheet.type";

if (isMainThread) {
    throw new Error("signsheet-pdf.worker.ts ต้องรันใน worker thread เท่านั้น");
}

// 3 levels up: workers → signsheet → modules → src, then into fonts
const FONTS_DIR = path.resolve(import.meta.dir, "../../../fonts");

const chunk = <T>(arr: T[], size: number): T[][] =>
    Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
        arr.slice(i * size, i * size + size),
    );

async function run() {
    try {
        const data = workerData as SignsheetPdfWorkerData;

        const doc = new PDFDocument({
            size:        "A4",
            margins:     { top: 28, bottom: 28, left: 25, right: 25 },
            autoFirstPage: false,
            bufferPages: false,
        });

        doc.registerFont("Sarabun",     path.join(FONTS_DIR, "THSarabunNew.ttf"));
        doc.registerFont("SarabunBold", path.join(FONTS_DIR, "THSarabunNew-Bold.ttf"));

        const fileName    = `signsheet_${data.campaign.id}_${data.session.id}_${Date.now()}.pdf`;
        const filePath    = path.join(os.tmpdir(), fileName);
        const writeStream = fs.createWriteStream(filePath);

        doc.pipe(writeStream);
        drawSignsheet(doc, data);
        doc.end();

        writeStream.on("finish", () => {
            parentPort?.postMessage({ status: "success", filePath, fileName });
        });
        writeStream.on("error", (err) => {
            parentPort?.postMessage({ status: "error", message: String(err) });
        });
    } catch (error) {
        parentPort?.postMessage({ status: "error", message: String(error) });
    }
}

function drawSignsheet(doc: InstanceType<typeof PDFDocument>, data: SignsheetPdfWorkerData) {
    const ROWS_PER_PAGE = 6;
    const TABLE_WIDTH   = 545.28;
    const COL_WIDTHS    = [40, TABLE_WIDTH - (40 + 120 + 120), 120, 120] as const;
    const HEADER_H      = 20;
    const ROW_H         = 110;

    const x1 = 25;
    const x2 = x1 + COL_WIDTHS[0];
    const x3 = x2 + COL_WIDTHS[1];
    const x4 = x3 + COL_WIDTHS[2];
    const x5 = x1 + TABLE_WIDTH;

    const rows       = data.rows;
    const pages      = chunk(rows, ROWS_PER_PAGE);
    if (pages.length === 0) pages.push([]);
    const totalPages = Math.max(1, pages.length);

    for (let pi = 0; pi < pages.length; pi++) {
        const pageNo   = pi + 1;
        const pageRows = [...(pages[pi] ?? [])] as (SignsheetRow | null)[];
        while (pageRows.length < ROWS_PER_PAGE) pageRows.push(null);

        doc.addPage();

        // ── Page number (top-right) ───────────────────────────────────────
        doc.font("Sarabun").fontSize(13).fillColor("#444444").text(
            `หน้า ${pageNo} / ${totalPages}`,
            x1,
            28,
            { width: TABLE_WIDTH, align: "right" },
        );

        // ── Page header ──────────────────────────────────────────────────
        const titleLine = data.examSubjects
            ? `ใบเซ็นชื่อสอบวิชา ${data.examSubjects} ${data.campaignLabel}`
            : `ใบเซ็นชื่อผู้เข้าสอบ ${data.campaignLabel}`;

        doc.font("SarabunBold").fontSize(16).fillColor("black").text(titleLine, { align: "center" });
        doc.moveDown(0.2);

        doc.font("Sarabun").fontSize(16).text(data.sessionText, { align: "center" });
        doc.moveDown(0.2);

        doc.font("Sarabun").fontSize(16).text(`ณ ${data.campaign.site ?? "-"}`, { align: "center" });
        doc.moveDown(0.5);

        // doc.font("Sarabun").fontSize(16).text(`ผู้เข้าสอบจำนวน ${rows.length} คน`, { align: "center" });
        // doc.moveDown(0.5);

        // ── Table frame ───────────────────────────────────────────────────
        const startY      = doc.y;
        const tableBottom = startY + HEADER_H + ROWS_PER_PAGE * ROW_H;

        doc.lineWidth(0.7).strokeColor("black").fillColor("black");

        for (const x of [x1, x2, x3, x4, x5]) {
            doc.moveTo(x, startY).lineTo(x, tableBottom).stroke();
        }
        doc.moveTo(x1, startY).lineTo(x5, startY).stroke();
        doc.moveTo(x1, startY + HEADER_H).lineTo(x5, startY + HEADER_H).stroke();

        // ── Column headers ────────────────────────────────────────────────
        const textY = startY + 4;
        doc.font("SarabunBold").fontSize(11).fillColor("black");
        doc.text("ลำดับ",                                                       x1,     textY, { width: COL_WIDTHS[0], align: "center" });
        doc.text("ชื่อ-นามสกุล / รหัสประจำตัวสอบ / ห้อง / แถว / ลำดับในแถว", x2 + 6, textY, { width: COL_WIDTHS[1], align: "left"   });
        doc.text("คิวอาร์โค้ดอ้างอิง",                                         x3,     textY, { width: COL_WIDTHS[2], align: "center" });
        doc.text("คิวอาร์โค้ดแปะเล่มข้อสอบ",                                  x4,     textY, { width: COL_WIDTHS[3], align: "center" });

        // ── Data rows ─────────────────────────────────────────────────────
        let currentY = startY + HEADER_H;

        for (let i = 0; i < pageRows.length; i++) {
            const row      = pageRows[i];
            const absIndex = pi * ROWS_PER_PAGE + i + 1;

            doc.moveTo(x1, currentY + ROW_H).lineTo(x5, currentY + ROW_H).stroke();

            if (row) {
                const paddingY = currentY + 6;
                const infoX    = x2 + 6;
                const fullName =
                    `${row.title ?? ""} ${row.firstName ?? ""} ${row.lastName ?? ""}`.trim() ||
                    row.fullName ||
                    "-";

                doc.font("Sarabun").fontSize(15).fillColor("black");
                doc.text(String(absIndex), x1, paddingY, { width: COL_WIDTHS[0], align: "center" });

                let infoY = paddingY;
                doc.text(fullName,                                                    infoX, infoY); infoY += 20;
                doc.text(`รหัสประจำตัวสอบ ${row.userCode ?? "-"}`,                  infoX, infoY); infoY += 20;
                doc.text(`ห้องสอบ ${row.roomCode ?? "-"}`,                           infoX, infoY); infoY += 20;
                doc.text(`แถวที่ ${row.rowNo ?? "-"} ลำดับที่ ${row.colNo ?? "-"}`,  infoX, infoY); infoY += 20;
                doc.text("ลายเซ็น..................................................",  infoX, infoY);

                // QR columns
                if (row.qrPayload) {
                    const qrSize  = 90;
                    const qrY     = currentY + (ROW_H - qrSize) / 2;
                    const qrX3    = x3 + (COL_WIDTHS[2] - qrSize) / 2;
                    const qrX4    = x4 + (COL_WIDTHS[3] - qrSize) / 2;
                    // สร้าง QR ครั้งเดียว วาดสองครั้ง
                    const qr = QRCode.create(row.qrPayload, { errorCorrectionLevel: "M" });
                    drawQrCode(doc, qr, qrX3, qrY, qrSize);
                    drawQrCode(doc, qr, qrX4, qrY, qrSize);
                } else {
                    const phY = currentY + ROW_H / 2 - 6;
                    doc.font("SarabunBold").fontSize(11).fillColor("#aaaaaa");
                    doc.text("-", x3, phY, { width: COL_WIDTHS[2], align: "center" });
                    doc.text("-", x4, phY, { width: COL_WIDTHS[3], align: "center" });
                }
            }

            currentY += ROW_H;
        }

    }
}

function drawQrCode(
    doc: InstanceType<typeof PDFDocument>,
    qr: ReturnType<typeof QRCode.create>,
    x: number,
    y: number,
    size: number,
) {
    const moduleCount = qr.modules.size;
    const moduleSize  = size / moduleCount;

    doc.save().fillColor("black");
    for (let r = 0; r < moduleCount; r++) {
        for (let c = 0; c < moduleCount; c++) {
            if (qr.modules.data[r * moduleCount + c]) {
                doc.rect(x + c * moduleSize, y + r * moduleSize, moduleSize, moduleSize);
            }
        }
    }
    doc.fill();
    doc.restore();
}

run();
