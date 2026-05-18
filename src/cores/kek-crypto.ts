/**
 * Key Hierarchy สำหรับ Campaign QR Encryption
 *
 * ┌─────────────────────────────────────────────────────────┐
 * │  Manager Key 1 (MK1)    Manager Key 2 (MK2)            │
 * │  (ไม่เก็บ plaintext)    (ไม่เก็บ plaintext)            │
 * │       │                       │                         │
 * │       ▼                       ▼                         │
 * │  hash(MK1) → DB         hash(MK2) → DB                 │
 * │  (PBKDF2, random salt)  (PBKDF2, random salt)           │
 * │       │                       │                         │
 * │       └───────┬───────────────┘                         │
 * │               ▼                                         │
 * │     HKDF(MK1 ‖ MK2, salt=campaignId)                  │
 * │               │                                         │
 * │               ▼                                         │
 * │     KEK (32 bytes) — never stored                       │
 * │               │                                         │
 * │         ┌─────┴─────┐                                   │
 * │         │  encrypt  │  DEK (16 bytes random) → DB       │
 * │         │ AES-256-GCM│  (encrypted with KEK)            │
 * │         └─────┬─────┘                                   │
 * │               ▼                                         │
 * │     DEK — ใช้ encrypt QR payload (AES-128-GCM)          │
 * └─────────────────────────────────────────────────────────┘
 *
 * DB storage:
 *  campaign_keys order_num=1  → hash(MK1) + salt
 *  campaign_keys order_num=2  → hash(MK2) + salt
 *  campaign_keys order_num=99 → encrypted DEK (wrapped by KEK)
 */

import {
    pbkdf2Sync,
    createHmac,
    createCipheriv,
    createDecipheriv,
    randomBytes,
} from "crypto";

// ── Constants ──────────────────────────────────────────────────────────────────
export const MANAGER_KEY_ORDER_1 = 1;
export const MANAGER_KEY_ORDER_2 = 2;
export const DEK_RECORD_ORDER    = 99; // order_num ของ record ที่เก็บ encrypted DEK

const PBKDF2_ITERATIONS = 100_000; // NIST recommended minimum 2024
const PBKDF2_KEY_LEN    = 32;      // 256 bits
const PBKDF2_DIGEST     = "sha256";
const PBKDF2_SALT_BYTES = 32;

const KEK_BYTES = 32;  // 256 bits — ใช้ AES-256-GCM wrap DEK
const DEK_BYTES = 16;  // 128 bits — ใช้ AES-128-GCM encrypt QR

// ── Manager Key Hashing (PBKDF2) ──────────────────────────────────────────────

/** Hash manager key สำหรับเก็บใน DB — ใช้ verify เท่านั้น (ไม่เก็บ plaintext) */
export function hashManagerKey(plaintextKey: string): { hash: string; salt: string } {
    const salt = randomBytes(PBKDF2_SALT_BYTES);
    const hash = pbkdf2Sync(plaintextKey, salt, PBKDF2_ITERATIONS, PBKDF2_KEY_LEN, PBKDF2_DIGEST);
    return {
        hash: hash.toString("base64"),
        salt: salt.toString("base64"),
    };
}

/** ตรวจสอบว่า key ที่ provide ตรงกับ hash ที่เก็บไว้ */
export function verifyManagerKey(
    plaintextKey: string,
    storedHashBase64: string,
    storedSaltBase64: string,
): boolean {
    const salt = Buffer.from(storedSaltBase64, "base64");
    const computed = pbkdf2Sync(plaintextKey, salt, PBKDF2_ITERATIONS, PBKDF2_KEY_LEN, PBKDF2_DIGEST);
    const stored = Buffer.from(storedHashBase64, "base64");
    // constant-time comparison ป้องกัน timing attack
    if (computed.length !== stored.length) return false;
    let diff = 0;
    for (let i = 0; i < computed.length; i++) diff |= computed[i]! ^ stored[i]!;
    return diff === 0;
}

// ── KEK Derivation (HKDF) ─────────────────────────────────────────────────────

/**
 * Derive KEK จาก MK1 + MK2 ด้วย HKDF-SHA256
 * KEK ไม่เคยถูกเก็บ — derive ใหม่ทุกครั้งที่ต้องการ
 */
export function deriveKEK(mk1Plaintext: string, mk2Plaintext: string, campaignId: number): Buffer {
    const mk1 = Buffer.from(mk1Plaintext, "utf8");
    const mk2 = Buffer.from(mk2Plaintext, "utf8");
    // IKM = MK1 ‖ MK2 (concatenated)
    const ikm  = Buffer.concat([mk1, mk2]);
    const salt = Buffer.from(`campaign-kek-salt-${campaignId}`, "utf8");
    const info = Buffer.from("campaign-kek-v1", "utf8");
    return hkdf(ikm, salt, info, KEK_BYTES);
}

/** HKDF-SHA256 implementation (RFC 5869) */
function hkdf(ikm: Buffer, salt: Buffer, info: Buffer, length: number): Buffer {
    // Extract
    const prk = createHmac("sha256", salt).update(ikm).digest();
    // Expand
    const blocks = Math.ceil(length / 32);
    let t   = Buffer.alloc(0);
    let okm = Buffer.alloc(0);
    for (let i = 1; i <= blocks; i++) {
        t = createHmac("sha256", prk)
            .update(Buffer.concat([t, info, Buffer.from([i])]))
            .digest();
        okm = Buffer.concat([okm, t]);
    }
    return okm.subarray(0, length);
}

// ── DEK Generation & Wrapping ─────────────────────────────────────────────────

/** สร้าง random DEK ใหม่ */
export function generateDEK(): Buffer {
    return randomBytes(DEK_BYTES);
}

/** Wrap DEK ด้วย KEK (AES-256-GCM) → JSON string สำหรับเก็บใน DB */
export function wrapDEK(dek: Buffer, kek: Buffer): string {
    const iv      = randomBytes(12); // 96-bit IV for GCM
    const cipher  = createCipheriv("aes-256-gcm", kek, iv);
    const encrypted = Buffer.concat([cipher.update(dek), cipher.final()]);
    const tag     = cipher.getAuthTag();
    return JSON.stringify({
        iv:   iv.toString("base64"),
        tag:  tag.toString("base64"),
        data: encrypted.toString("base64"),
    });
}

/** Unwrap DEK ด้วย KEK — ถ้า key ผิดหรือ tamper จะ throw */
export function unwrapDEK(wrappedJson: string, kek: Buffer): Buffer {
    let parsed: { iv: string; tag: string; data: string };
    try {
        parsed = JSON.parse(wrappedJson);
    } catch {
        throw new Error("Wrapped DEK format ไม่ถูกต้อง");
    }

    const iv       = Buffer.from(parsed.iv, "base64");
    const tag      = Buffer.from(parsed.tag, "base64");
    const cipherData = Buffer.from(parsed.data, "base64");

    const decipher = createDecipheriv("aes-256-gcm", kek, iv);
    decipher.setAuthTag(tag);

    try {
        return Buffer.concat([decipher.update(cipherData), decipher.final()]);
    } catch {
        throw new Error("ถอดรหัส DEK ไม่ได้ — Manager key ผิด หรือข้อมูลถูกแก้ไข");
    }
}
