import { Worker } from "worker_threads";
import path from "path";

const WORKER_PATH = path.resolve(import.meta.dir, "../workers/booklet-encrypt.worker.ts");
const ENCRYPT_TIMEOUT_MS = 60_000; // 60 วินาที — 8000 เล่มยังเหลือ margin

export interface BookletRecord {
    campaign_id: number;
    session_id: number;
    qr_payload: string;
    user_code: string;
}

export async function runBookletEncryptWorker(
    user_codes: string[],
    combinedKeyBase64: string,
    campaignId: number,
    sessionId: number,
): Promise<BookletRecord[]> {
    return new Promise((resolve, reject) => {
        const worker = new Worker(WORKER_PATH, {
            workerData: { user_codes, combinedKeyBase64, campaignId, sessionId },
        });

        const timer = setTimeout(() => {
            worker.terminate();
            reject(new Error("Booklet encryption timeout"));
        }, ENCRYPT_TIMEOUT_MS);

        worker.on("message", (msg: { success: boolean; records?: BookletRecord[]; error?: string }) => {
            clearTimeout(timer);
            if (msg.success && msg.records) {
                resolve(msg.records);
            } else {
                reject(new Error(msg.error ?? "Booklet encryption failed"));
            }
        });

        worker.on("error", (err) => {
            clearTimeout(timer);
            reject(err);
        });
    });
}
