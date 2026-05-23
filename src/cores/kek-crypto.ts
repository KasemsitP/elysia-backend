/**
 * Key Hierarchy สำหรับ Campaign QR Encryption
 *
 * ┌─────────────────────────────────────────────────────────┐
 * │  Manager Key 1 (MK1)    Manager Key 2 (MK2)            │
 * │       │                       │                         │
 * │       ▼                       ▼                         │
 * │  AES-256-GCM(MASTER_KEY) → key_ciphertext in DB        │
 * │       │                       │                         │
 * │       ▼ (decrypt)             ▼ (decrypt)               │
 * │  MK1 plaintext          MK2 plaintext                   │
 * │       │                       │                         │
 * │       └───────┬───────────────┘                         │
 * │               ▼                                         │
 * │     HKDF(MK1 ‖ MK2, salt=campaignId)                  │
 * │               │                                         │
 * │               ▼                                         │
 * │     combinedKey (32 bytes) — never stored               │
 * │               │                                         │
 * │               ▼                                         │
 * │     AES-256-GCM encrypt QR payload                      │
 * └─────────────────────────────────────────────────────────┘
 *
 * DB storage:
 *  campaign_keys order_num=1  → AES-256-GCM(MASTER_KEY, MK1) → base64 in key_ciphertext
 *  campaign_keys order_num=2  → AES-256-GCM(MASTER_KEY, MK2) → base64 in key_ciphertext
 *  Format: [IV 12 bytes][TAG 16 bytes][CIPHERTEXT] → base64, iv column = null
 */

import {
    createCipheriv,
    createDecipheriv,
    createHmac,
    randomBytes,
    timingSafeEqual,
} from "crypto";

// ── Constants ──────────────────────────────────────────────────────────────────
export const MANAGER_KEY_ORDER_1 = 1;
export const MANAGER_KEY_ORDER_2 = 2;

const WRAP_ALGORITHM = "aes-256-gcm" as const;
const WRAP_IV_BYTES  = 12;
const WRAP_TAG_BYTES = 16;

// ── MASTER_KEY loader ─────────────────────────────────────────────────────────

function getMasterKey(): Buffer {
    const hex = process.env.MASTER_KEY;
    if (!hex || hex.length !== 64) {
        throw new Error("MASTER_KEY ไม่ได้ตั้งค่า หรือไม่ใช่ hex 32 bytes (64 chars)");
    }
    return Buffer.from(hex, "hex");
}

// ── Manager Key Wrap / Unwrap (AES-256-GCM with MASTER_KEY) ──────────────────

/**
 * Encrypt MK plaintext with MASTER_KEY.
 * Returns binary [IV 12][TAG 16][CIPHERTEXT] encoded as base64.
 * Store result in key_ciphertext column; set iv column to null.
 */
export function wrapManagerKey(plaintext: string): string {
    const masterKey  = getMasterKey();
    const iv         = randomBytes(WRAP_IV_BYTES);
    const cipher     = createCipheriv(WRAP_ALGORITHM, masterKey, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const tag        = cipher.getAuthTag();
    return Buffer.concat([iv, tag, ciphertext]).toString("base64");
}

/**
 * Decrypt wrapped MK back to plaintext using MASTER_KEY.
 * Expects base64 string from key_ciphertext column.
 */
export function unwrapManagerKey(wrappedBase64: string): string {
    const masterKey  = getMasterKey();
    const buf        = Buffer.from(wrappedBase64, "base64");
    if (buf.length < WRAP_IV_BYTES + WRAP_TAG_BYTES) {
        throw new Error("Manager key ciphertext สั้นเกินไป");
    }
    const iv         = buf.subarray(0, WRAP_IV_BYTES);
    const tag        = buf.subarray(WRAP_IV_BYTES, WRAP_IV_BYTES + WRAP_TAG_BYTES);
    const ciphertext = buf.subarray(WRAP_IV_BYTES + WRAP_TAG_BYTES);
    const decipher   = createDecipheriv(WRAP_ALGORITHM, masterKey, iv);
    decipher.setAuthTag(tag);
    try {
        return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
    } catch {
        throw new Error("ถอดรหัส Manager Key ไม่ได้ — MASTER_KEY อาจเปลี่ยน");
    }
}

/**
 * Constant-time string comparison (UTF-8) — avoids early-exit timing leaks.
 */
export function timingSafeStringEqual(a: string, b: string): boolean {
    const bufA = Buffer.from(a, "utf8");
    const bufB = Buffer.from(b, "utf8");
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
}

// ── Combined Key Derivation (HKDF) ────────────────────────────────────────────

/**
 * Derive a 32-byte AES-256 key from MK1 + MK2 via HKDF-SHA256.
 * Deterministic — same inputs always produce the same key.
 * Never stored; re-derived on every request that needs it.
 */
export function deriveCombinedKey(mk1Plaintext: string, mk2Plaintext: string, campaignId: number): Buffer {
    const ikm  = Buffer.concat([Buffer.from(mk1Plaintext, "utf8"), Buffer.from(mk2Plaintext, "utf8")]);
    const salt = Buffer.from(`campaign-qr-salt-${campaignId}`, "utf8");
    const info = Buffer.from("campaign-combined-key-v1", "utf8");
    return hkdf(ikm, salt, info, 32); // 256 bits — for AES-256-GCM
}

/** HKDF-SHA256 (RFC 5869) */
function hkdf(ikm: Buffer, salt: Buffer, info: Buffer, length: number): Buffer {
    const prk    = createHmac("sha256", salt).update(ikm).digest();
    const blocks = Math.ceil(length / 32);
    let t   = Buffer.alloc(0);
    let okm = Buffer.alloc(0);
    for (let i = 1; i <= blocks; i++) {
        t   = createHmac("sha256", prk).update(Buffer.concat([t, info, Buffer.from([i])])).digest();
        okm = Buffer.concat([okm, t]);
    }
    return okm.subarray(0, length);
}
