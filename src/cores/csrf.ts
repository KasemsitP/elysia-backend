/**
 * CSRF Protection — Double Submit Cookie + Signed Token
 *
 * Flow:
 * 1. GET /api/csrf-token → return signed token ใน header X-CSRF-Token
 * 2. Client เก็บ token และส่ง X-CSRF-Token header กับ POST/PUT/PATCH/DELETE ทุก request
 * 3. Server verify signature ก่อน allow
 *
 * Token format: base64(hmac-sha256(sessionId + timestamp, CSRF_SECRET))
 * - ผูกกับ session → token ของ session อื่นใช้ไม่ได้
 * - มี expiry 1 ชั่วโมง
 */
import { createHmac, timingSafeEqual } from "crypto";
import { Elysia } from "elysia";
import { env } from "./env";
import { AppError } from "./errors";
import { sessionPlugin } from "./session";

const CSRF_TTL_SECONDS = 60 * 60; // 1 hour
const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
// Paths ที่ยกเว้น CSRF (เช่น login ที่ไม่มี session ก่อน)
const CSRF_EXEMPT = new Set(["/api/auth/login", "/api/auth/register", "/health", "/health/db"]);

function sign(payload: string): string {
    return createHmac("sha256", env.CSRF_SECRET).update(payload).digest("base64url");
}

export function generateCsrfToken(sessionId: string): string {
    const ts = Math.floor(Date.now() / 1000);
    const payload = `${sessionId}:${ts}`;
    const sig = sign(payload);
    return `${Buffer.from(payload).toString("base64url")}.${sig}`;
}

export function verifyCsrfToken(token: string, sessionId: string): boolean {
    try {
        const [payloadB64, sig] = token.split(".");
        if (!payloadB64 || !sig) return false;

        const payload = Buffer.from(payloadB64, "base64url").toString();
        const [sid, tsStr] = payload.split(":");
        if (!sid || !tsStr) return false;

        // ตรวจ session ตรงกัน
        if (sid !== sessionId) return false;

        // ตรวจ expiry
        const ts = Number(tsStr);
        if (Date.now() / 1000 - ts > CSRF_TTL_SECONDS) return false;

        // ตรวจ signature (constant-time)
        const expectedSig = sign(payload);
        const a = Buffer.from(sig);
        const b = Buffer.from(expectedSig);
        if (a.length !== b.length) return false;
        return timingSafeEqual(a, b);
    } catch {
        return false;
    }
}

// ── Elysia plugin ────────────────────────────────────────────────────────────

/** เพิ่ม CSRF protection ให้ทุก mutation endpoint */
export const csrfPlugin = new Elysia({ name: "csrf" })
    .use(sessionPlugin)
    // Endpoint สำหรับขอ token ใหม่
    .get("/api/csrf-token", ({ session, set }) => {
        if (!session) throw new AppError("กรุณาเข้าสู่ระบบ", 401);
        const token = generateCsrfToken(session.account_id.toString());
        set.headers["X-CSRF-Token"] = token;
        return { success: true, message: "CSRF token", data: { csrf_token: token } };
    })
    // Middleware: validate CSRF บน mutation requests
    .onBeforeHandle({ as: "global" }, ({ request, session, set }) => {
        const method = request.method.toUpperCase();
        if (!MUTATION_METHODS.has(method)) return;

        const url = new URL(request.url);
        if (CSRF_EXEMPT.has(url.pathname)) return;

        // ถ้าไม่มี session → CSRF ไม่ต้องเช็ค (จะ 401 จาก requireSession เอง)
        if (!session) return;

        const token = request.headers.get("x-csrf-token") ?? request.headers.get("x-xsrf-token");
        if (!token) {
            set.status = 403;
            return { success: false, message: "Missing CSRF token" };
        }

        if (!verifyCsrfToken(token, session.account_id.toString())) {
            set.status = 403;
            return { success: false, message: "Invalid or expired CSRF token" };
        }
    });
