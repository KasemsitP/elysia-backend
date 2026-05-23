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
}

interface BookletRecord {
    campaign_id: number;
    session_id: number;
    qr_payload: string;
    user_code: string;
}

const { user_codes, combinedKeyBase64, campaignId, sessionId } = workerData as EncryptJob;

try {
    const records: BookletRecord[] = user_codes.map((user_code) => {
        const nonce = randomBytes(8).toString("hex");
        const qr_payload = encryptQrPayload(
            { cid: campaignId, sid: sessionId, user_code, nonce },
            combinedKeyBase64,
        );
        return { campaign_id: campaignId, session_id: sessionId, qr_payload, user_code };
    });

    parentPort!.postMessage({ success: true, records });
} catch (err) {
    parentPort!.postMessage({ success: false, error: err instanceof Error ? err.message : String(err) });
}
