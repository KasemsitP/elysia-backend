/**
 * Unit tests: QR Payload Encryption (AES-256-GCM)
 *
 * Tests encryptQrPayload and decryptQrPayload from src/cores/qr-crypto.ts.
 *
 * Run: bun test tests/unit/qr-crypto.test.ts
 */
import { describe, it, expect } from "bun:test";
import { encryptQrPayload, decryptQrPayload } from "../../src/cores/qr-crypto";
import type { QrPayloadData } from "../../src/cores/qr-crypto";
import { randomBytes } from "crypto";

function makeKey32(): string {
    return randomBytes(32).toString("base64");
}

const sampleData: QrPayloadData = {
    cid: 10,
    sid: 10,
    uc: "10001",
    nonce: "a1b2c3d4",
};

// ── Round-trip ─────────────────────────────────────────────────────────────────

describe("Round-trip: encrypt → decrypt คืนข้อมูลเดิม", () => {
    it("ถอดรหัสได้ข้อมูลครบถ้วน", () => {
        const key = makeKey32();
        const encrypted = encryptQrPayload(sampleData, key);
        const decrypted = decryptQrPayload(encrypted, key);
        expect(decrypted.cid).toBe(sampleData.cid);
        expect(decrypted.sid).toBe(sampleData.sid);
        expect(decrypted.uc).toBe(sampleData.uc);
        expect(decrypted.nonce).toBe(sampleData.nonce);
    });

    it("เข้ารหัสทุกครั้งได้ ciphertext ต่างกัน (IV random)", () => {
        const key = makeKey32();
        const enc1 = encryptQrPayload(sampleData, key);
        const enc2 = encryptQrPayload(sampleData, key);
        expect(enc1).not.toBe(enc2);
    });

    it("ถอดรหัสด้วย key เดิมได้เสมอ แม้ IV ต่างกัน", () => {
        const key = makeKey32();
        const enc1 = encryptQrPayload(sampleData, key);
        const enc2 = encryptQrPayload(sampleData, key);
        expect(decryptQrPayload(enc1, key)).toEqual(sampleData);
        expect(decryptQrPayload(enc2, key)).toEqual(sampleData);
    });

    it("รองรับ uc ที่มีอักขระพิเศษ", () => {
        const key = makeKey32();
        const d: QrPayloadData = { cid: 1, sid: 1, uc: "U-001/รอบ1", nonce: "ff" };
        const enc = encryptQrPayload(d, key);
        expect(decryptQrPayload(enc, key).uc).toBe("U-001/รอบ1");
    });

    it("รองรับ campaignId และ sessionId ขนาดใหญ่", () => {
        const key = makeKey32();
        const d: QrPayloadData = { cid: 99999, sid: 88888, uc: "X", nonce: "00" };
        const enc = encryptQrPayload(d, key);
        const dec = decryptQrPayload(enc, key);
        expect(dec.cid).toBe(99999);
        expect(dec.sid).toBe(88888);
    });
});

// ── encryptQrPayload ───────────────────────────────────────────────────────────

describe("encryptQrPayload: ผลลัพธ์เป็น base64 ที่ถูกต้อง", () => {
    it("คืน string ที่ไม่ว่าง", () => {
        const key = makeKey32();
        const result = encryptQrPayload(sampleData, key);
        expect(typeof result).toBe("string");
        expect(result.length).toBeGreaterThan(0);
    });

    it("base64 decode ได้ buffer ขนาด >= IV(12) + TAG(16) + plaintext", () => {
        const key = makeKey32();
        const enc = encryptQrPayload(sampleData, key);
        const buf = Buffer.from(enc, "base64");
        // minimum = 12 + 16 = 28 bytes (before any plaintext)
        expect(buf.length).toBeGreaterThan(28);
    });

    it("key ขนาดไม่ใช่ 32 bytes → throw", () => {
        const badKey = Buffer.from("short").toString("base64"); // < 32 bytes
        expect(() => encryptQrPayload(sampleData, badKey)).toThrow();
    });
});

// ── decryptQrPayload ───────────────────────────────────────────────────────────

describe("decryptQrPayload: ป้องกัน tamper", () => {
    it("payload ที่ถูก tamper (bit flip) → throw", () => {
        const key = makeKey32();
        const enc = encryptQrPayload(sampleData, key);
        const buf = Buffer.from(enc, "base64");
        // flip a byte in the ciphertext area (after IV+TAG = 28 bytes)
        if (buf.length > 28) buf[28] ^= 0xff;
        const tampered = buf.toString("base64");
        expect(() => decryptQrPayload(tampered, key)).toThrow();
    });

    it("payload สั้นเกินไป → throw", () => {
        const key = makeKey32();
        const shortPayload = Buffer.from("tooshort").toString("base64");
        expect(() => decryptQrPayload(shortPayload, key)).toThrow();
    });

    it("ถอดรหัสด้วย key ผิด → throw", () => {
        const key1 = makeKey32();
        const key2 = makeKey32();
        const enc = encryptQrPayload(sampleData, key1);
        expect(() => decryptQrPayload(enc, key2)).toThrow();
    });

    it("string เปล่า → throw", () => {
        const key = makeKey32();
        expect(() => decryptQrPayload("", key)).toThrow();
    });
});
