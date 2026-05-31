import { workerData, parentPort, isMainThread } from "worker_threads";
import { randomBytes } from "crypto";
import { encryptQrPayload } from "../cores/qr-crypto";

if (isMainThread) {
    throw new Error("booklet-encrypt.worker.ts ต้องรันใน worker thread เท่านั้น");
}

interface EncryptJob {
    user_codes: string[];
    combinedKeyBase64: string;
    campaignId: number;
    sessionId: number;
    startIndex: number; // offset สำหรับ random_num — generate ชุดที่ N เริ่มจาก startIndex+1
}

interface BookletRecord {
    campaign_id: number;
    session_id: number;
    qr_payload: string;
    random_num: string;
}

const { user_codes, combinedKeyBase64, campaignId, sessionId, startIndex } = workerData as EncryptJob;

try {
    const records: BookletRecord[] = user_codes.map((user_code, index) => {
        const nonce      = randomBytes(8).toString("hex");
        const qr_payload = encryptQrPayload(
            { cid: campaignId, sid: sessionId, uc: user_code, nonce },
            combinedKeyBase64,
        );
        const random_num = (startIndex + index + 1).toString().padStart(4, "0");
        return { campaign_id: campaignId, session_id: sessionId, qr_payload, random_num };
    });

    parentPort!.postMessage({ success: true, records });
} catch (err) {
    parentPort!.postMessage({ success: false, error: err instanceof Error ? err.message : String(err) });
}
