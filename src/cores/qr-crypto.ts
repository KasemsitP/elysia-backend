/**
 * QR Payload Encryption — AES-128-GCM
 *
 * หลักการ:
 * - ใช้ AES-128-GCM เพราะมี Authentication Tag (ตรวจ tamper ได้)
 * - IV ต้อง random ทุกครั้ง — ห้าม reuse กับ GCM เด็ดขาด (nonce reuse = break)
 * - เก็บ encrypted envelope เป็น JSON string ใน booklets.qr_payload
 * - key เก็บใน campaign_keys.key_ciphertext (base64)
 *
 * Format ของ qr_payload ที่เก็บใน DB:
 * {
 *   "v":   1,          // schema version (รองรับ key rotation)
 *   "kid": 1,          // campaign_keys.order_num — รู้ว่าต้องใช้ key ไหน
 *   "iv":  "base64",   // 12-byte random IV (96 bits)
 *   "tag": "base64",   // 16-byte GCM auth tag — verify integrity
 *   "data":"base64"    // ciphertext
 * }
 *
 * Plaintext ที่ encrypt:
 * { "cid": campaignId, "sid": sessionId, "nonce": "8-byte hex" }
 */

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-128-gcm" as const;
const KEY_BYTES = 16;  // 128 bits
const IV_BYTES = 12;   // 96 bits — recommended length สำหรับ GCM

export type QrPayloadData = {
    cid: number;   // campaign_id
    sid: number;   // session_id
    nonce: string; // random per-booklet nonce — ensure unique payload
};

type EncryptedQrEnvelope = {
    v: 1;
    kid: number;
    iv: string;
    tag: string;
    data: string;
};

// สร้าง AES-128 key ใหม่ → return base64 (เก็บใน campaign_keys.key_ciphertext)
export function generateAesKey(): string {
    return randomBytes(KEY_BYTES).toString("base64");
}

export function encryptQrPayload(
    data: QrPayloadData,
    keyBase64: string,
    keyOrderNum: number,
): string {
    const key = Buffer.from(keyBase64, "base64");
    if (key.length !== KEY_BYTES) throw new Error("AES key ต้องมีขนาด 16 bytes (128 bits)");

    // random IV ใหม่ทุกครั้ง — ห้าม reuse กับ GCM
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, key, iv);

    const plaintext = JSON.stringify(data);
    const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag(); // GCM authentication tag

    const envelope: EncryptedQrEnvelope = {
        v: 1,
        kid: keyOrderNum,
        iv: iv.toString("base64"),
        tag: tag.toString("base64"),
        data: encrypted.toString("base64"),
    };

    return JSON.stringify(envelope);
}

export function decryptQrPayload(qrPayloadStr: string, keyBase64: string): QrPayloadData {
    let envelope: EncryptedQrEnvelope;
    try {
        envelope = JSON.parse(qrPayloadStr) as EncryptedQrEnvelope;
    } catch {
        throw new Error("QR payload format ไม่ถูกต้อง");
    }

    const key = Buffer.from(keyBase64, "base64");
    const iv = Buffer.from(envelope.iv, "base64");
    const tag = Buffer.from(envelope.tag, "base64");
    const encryptedData = Buffer.from(envelope.data, "base64");

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag); // GCM จะ verify tag ตอน final() — tamper = throw

    try {
        const decrypted = Buffer.concat([decipher.update(encryptedData), decipher.final()]);
        return JSON.parse(decrypted.toString("utf8")) as QrPayloadData;
    } catch {
        throw new Error("ถอดรหัส QR ไม่ได้ — payload อาจถูกแก้ไข");
    }
}

// อ่าน key order_num จาก envelope โดยไม่ต้อง decrypt — ใช้หา key ที่ถูกต้องจาก DB
export function getKeyOrderNumFromPayload(qrPayloadStr: string): number {
    try {
        const envelope = JSON.parse(qrPayloadStr) as { kid: number };
        return envelope.kid;
    } catch {
        throw new Error("QR payload format ไม่ถูกต้อง");
    }
}

// ดึง campaign key จาก DB ตาม order_num
export async function getCampaignKey(campaign_id: number, orderNum: number) {
    const { prisma } = await import("./prisma");
    const key = await prisma.campaign_keys.findFirst({
        where: { campaign_id, order_num: orderNum, active: true },
    });
    if (!key?.key_ciphertext) throw new Error(`ไม่พบ key order ${orderNum} สำหรับ campaign ${campaign_id}`);
    return key;
}

// ดึง active key ล่าสุด หรือสร้างใหม่ถ้ายังไม่มี
export async function getOrCreateActiveCampaignKey(campaign_id: number) {
    const { prisma } = await import("./prisma");

    const existing = await prisma.campaign_keys.findFirst({
        where: { campaign_id, active: true, deleted_at: null },
        orderBy: { order_num: "desc" },
    });
    if (existing?.key_ciphertext) return existing;

    // ยังไม่มี key → สร้างใหม่อัตโนมัติ
    const maxOrder = await prisma.campaign_keys.aggregate({
        where: { campaign_id },
        _max: { order_num: true },
    });

    return prisma.campaign_keys.create({
        data: {
            campaign_id,
            key_ciphertext: generateAesKey(),
            algor: "AES-128-GCM",
            order_num: (maxOrder._max.order_num ?? 0) + 1,
            active: true,
        },
    });
}
