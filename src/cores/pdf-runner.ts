/**
 * PDF Runner — spawn worker thread และรอ Buffer
 * ใช้ใน service/route ที่ต้องการ PDF
 */
import { Worker } from "worker_threads";
import path from "path";

const WORKER_PATH = path.resolve(import.meta.dir, "../workers/pdf.worker.ts");
const PDF_TIMEOUT_MS = 30_000; // 30 วินาที

export type PdfJobType =
    | "bag-scores"
    | "bag-manual-score-sheet"
    | "campaign-score-summary"
    | "passing-list"
    | "grader-workload";

export async function runPdfWorker(type: PdfJobType, data: unknown): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const worker = new Worker(WORKER_PATH, {
            workerData: { type, data },
        });

        const timer = setTimeout(() => {
            worker.terminate();
            reject(new Error("PDF generation timeout"));
        }, PDF_TIMEOUT_MS);

        worker.on("message", (msg: { success: boolean; buffer?: Uint8Array; error?: string }) => {
            clearTimeout(timer);
            if (msg.success && msg.buffer) {
                resolve(Buffer.from(msg.buffer));
            } else {
                reject(new Error(msg.error ?? "PDF generation failed"));
            }
        });

        worker.on("error", (err) => {
            clearTimeout(timer);
            reject(err);
        });
    });
}
