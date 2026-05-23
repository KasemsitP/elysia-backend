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
 * │     combinedKey (16 bytes) — never stored               │
 * │               │                                         │
 * │               ▼                                         │
 * │     AES-128-GCM encrypt QR payload                      │
 * └─────────────────────────────────────────────────────────┘
 *
 * DB storage:
 *  campaign_keys order_num=1  → hash(MK1) + salt
 *  campaign_keys order_num=2  → hash(MK2) + salt
 */

import {
    pbkdf2Sync,
    createHmac,
    randomBytes,
} from "crypto";

// ── Constants ──────────────────────────────────────────────────────────────────
export const MANAGER_KEY_ORDER_1 = 1;
export const MANAGER_KEY_ORDER_2 = 2;

const PBKDF2_ITERATIONS = 100_000;
const PBKDF2_KEY_LEN    = 32;
const PBKDF2_DIGEST     = "sha256";
const PBKDF2_SALT_BYTES = 32;

// ── Manager Key Hashing (PBKDF2) ──────────────────────────────────────────────

export function hashManagerKey(plaintextKey: string): { hash: string; salt: string } {
    const salt = randomBytes(PBKDF2_SALT_BYTES);
    const hash = pbkdf2Sync(plaintextKey, salt, PBKDF2_ITERATIONS, PBKDF2_KEY_LEN, PBKDF2_DIGEST);
    return {
        hash: hash.toString("base64"),
        salt: salt.toString("base64"),
    };
}

export function verifyManagerKey(
    plaintextKey: string,
    storedHashBase64: string,
    storedSaltBase64: string,
): boolean {
    const salt     = Buffer.from(storedSaltBase64, "base64");
    const computed = pbkdf2Sync(plaintextKey, salt, PBKDF2_ITERATIONS, PBKDF2_KEY_LEN, PBKDF2_DIGEST);
    const stored   = Buffer.from(storedHashBase64, "base64");
    if (computed.length !== stored.length) return false;
    let diff = 0;
    for (let i = 0; i < computed.length; i++) diff |= computed[i]! ^ stored[i]!;
    return diff === 0;
}

// ── Combined Key Derivation (HKDF) ────────────────────────────────────────────

/**
 * Derive a 16-byte AES-128 key from MK1 + MK2 via HKDF-SHA256.
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
