import { Worker } from "worker_threads";
import path from "path";
import type { SignsheetPdfWorkerData, SignsheetPdfResult } from "./signsheet.type";

const WORKER_PATH    = path.resolve(import.meta.dir, "./workers/signsheet-pdf.worker.ts");
const PDF_TIMEOUT_MS = 120_000; // 2 นาที

type WorkerMsg = { status: "success"; filePath: string; fileName: string }
              | { status: "error";   message: string };

export function runSignsheetPdfWorker(data: SignsheetPdfWorkerData): Promise<SignsheetPdfResult> {
    return new Promise((resolve, reject) => {
        const worker = new Worker(WORKER_PATH, { workerData: data });

        const timer = setTimeout(() => {
            worker.terminate();
            reject(new Error("Signsheet PDF generation timeout"));
        }, PDF_TIMEOUT_MS);

        worker.on("message", (msg: WorkerMsg) => {
            clearTimeout(timer);
            if (msg.status === "success") {
                resolve({ filePath: msg.filePath, fileName: msg.fileName });
            } else {
                reject(new Error(msg.message ?? "Signsheet PDF generation failed"));
            }
        });

        worker.on("error", (err) => {
            clearTimeout(timer);
            reject(err);
        });
    });
}
