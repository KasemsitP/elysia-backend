/**
 * QR Payload Encryption — AES-128-GCM
 *
 * Key: combinedKey (16 bytes) derived from Manager Key 1 + Manager Key 2 via HKDF
 * Both manager keys are required to encrypt and decrypt.
 *
 * Binary format stored in booklets.qr_payload (base64):
 *   [ IV 12 bytes ][ TAG 16 bytes ][ CIPHERTEXT ... ]
 *
 * Plaintext:
 *   { "cid": campaignId, "sid": sessionId, "user_code": "...", "nonce": "8-byte hex" }
 *
 * During exam: compare qr_payload base64 string directly against DB — no decrypt
 * After unlock: decrypt with combinedKey → get user_code → join users
 */

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm" as const;
const KEY_BYTES = 32; // 256 bits
const IV_BYTES  = 12; // 96 bits — recommended for GCM
const TAG_BYTES = 16; // GCM auth tag

export type QrPayloadData = {
    cid: number;
    sid: number;
    uc: string;
    nonce: string;
};

export function encryptQrPayload(data: QrPayloadData, keyBase64: string): string {
    const key = Buffer.from(keyBase64, "base64");
    if (key.length !== KEY_BYTES) throw new Error("AES key ต้องมีขนาด 32 bytes (256 bits)");

    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, key, iv);

    const plaintext = JSON.stringify(data);
    const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();

    // Binary layout: [IV 12][TAG 16][CIPHERTEXT]
    return Buffer.concat([iv, tag, ciphertext]).toString("base64");
}

export function decryptQrPayload(qrPayloadBase64: string, keyBase64: string): QrPayloadData {
    const key = Buffer.from(keyBase64, "base64");
    const buf = Buffer.from(qrPayloadBase64, "base64");

    if (buf.length < IV_BYTES + TAG_BYTES) {
        throw new Error("QR payload สั้นเกินไป");
    }

    const iv         = buf.subarray(0, IV_BYTES);
    const tag        = buf.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
    const ciphertext = buf.subarray(IV_BYTES + TAG_BYTES);

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag); // GCM verify tag ตอน final() — tamper = throw

    try {
        const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
        return JSON.parse(decrypted.toString("utf8")) as QrPayloadData;
    } catch {
        throw new Error("ถอดรหัส QR ไม่ได้ — payload อาจถูกแก้ไข");
    }
}
