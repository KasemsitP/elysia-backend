/**
 * Rate limiting middleware สำหรับ Elysia
 *
 * ชั้นการทำงาน:
 * 1. Redis (primary)   — sliding window, accurate across instances
 * 2. In-memory (fallback) — ถ้า Redis ล่ม, fail-CLOSED สำหรับ critical endpoints
 *
 * Redis key convention:
 *   rl:{endpoint}:{identifier}  เช่น rl:login:192.168.1.1
 *
 * Policy (ตาม claude.md):
 *   login:        5 req / 60s  / IP
 *   otp/request:  3 req / 300s / IP
 *   otp/verify:  10 req / 60s  / IP
 *   scan:       120 req / 60s  / IP
 */
import { Elysia } from "elysia";
import { isRateLimited } from "./redis";
import { logger } from "./logger";

// ── In-memory fallback (LRU-style cleanup every 5 min) ────────────────────────

type MemEntry = { count: number; resetAt: number };
const _memStore = new Map<string, MemEntry>();
let _lastCleanup = Date.now();

/** Reset in-memory store — ใช้ใน test เท่านั้น */
export function _testResetMemStore() { _memStore.clear(); }

function memCheck(key: string, limit: number, windowMs: number): { limited: boolean; ttl: number } {
    const now = Date.now();

    // cleanup every 5 minutes
    if (now - _lastCleanup > 5 * 60_000) {
        for (const [k, v] of _memStore) {
            if (v.resetAt < now) _memStore.delete(k);
        }
        _lastCleanup = now;
    }

    const entry = _memStore.get(key);
    if (!entry || entry.resetAt < now) {
        _memStore.set(key, { count: 1, resetAt: now + windowMs });
        return { limited: false, ttl: 0 };
    }

    if (entry.count >= limit) {
        return { limited: true, ttl: Math.ceil((entry.resetAt - now) / 1000) };
    }

    entry.count++;
    return { limited: false, ttl: 0 };
}

// ── Plugin factory ────────────────────────────────────────────────────────────

export type RateLimitOptions = {
    name: string;
    limit: number;
    windowSecs: number;
    keyFn: (req: Request) => string;
    message?: string;
    /**
     * failClosed: true → ถ้า Redis ล่ม ใช้ in-memory limiter แทน (ไม่ allow ผ่าน)
     * failClosed: false → ถ้า Redis ล่ม allow ผ่านทั้งหมด (fail-open)
     */
    failClosed?: boolean;
};

export function rateLimitPlugin(opts: RateLimitOptions) {
    return new Elysia({ name: `rl:${opts.name}` })
        .onBeforeHandle(async ({ request, set }) => {
            const key = `rl:${opts.name}:${opts.keyFn(request)}`;

            try {
                const { limited, ttl } = await isRateLimited(key, opts.limit, opts.windowSecs);
                if (limited) {
                    set.headers["Retry-After"] = String(ttl);
                    set.status = 429;
                    return { success: false, message: opts.message ?? `ทำรายการบ่อยเกินไป กรุณารอ ${ttl} วินาที` };
                }
            } catch {
                // Redis ล่ม
                logger.warn(`[RateLimit] Redis unavailable for key "${key}"${opts.failClosed ? ", using in-memory fallback" : ", fail-open"}`);

                if (opts.failClosed) {
                    // fail-CLOSED: ใช้ in-memory แทน
                    const { limited, ttl } = memCheck(key, opts.limit, opts.windowSecs * 1000);
                    if (limited) {
                        set.headers["Retry-After"] = String(ttl);
                        set.status = 429;
                        return { success: false, message: opts.message ?? `ทำรายการบ่อยเกินไป กรุณารอ ${ttl} วินาที` };
                    }
                }
                // fail-OPEN: allow ผ่าน
            }
        });
}

function getIP(req: Request): string {
    return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

// ── Pre-built limiters ─────────────────────────────────────────────────────────

/** Login — fail-CLOSED (brute force protection) */
export const loginRateLimit = rateLimitPlugin({
    name: "login",
    limit: 5,
    windowSecs: 60,
    keyFn: getIP,
    message: "พยายาม login บ่อยเกินไป กรุณารอ 1 นาที",
    failClosed: true,
});

/** OTP request — fail-CLOSED */
export const otpRequestRateLimit = rateLimitPlugin({
    name: "otp-req",
    limit: 3,
    windowSecs: 300,
    keyFn: getIP,
    message: "ขอ OTP บ่อยเกินไป กรุณารอ 5 นาที",
    failClosed: true,
});

/** OTP verify — fail-CLOSED */
export const otpVerifyRateLimit = rateLimitPlugin({
    name: "otp-verify",
    limit: 10,
    windowSecs: 60,
    keyFn: getIP,
    message: "พยายาม verify OTP บ่อยเกินไป",
    failClosed: true,
});

/** Scan QR — fail-open (operational, don't block staff) */
export const scanRateLimit = rateLimitPlugin({
    name: "scan",
    limit: 120,
    windowSecs: 60,
    keyFn: getIP,
    message: "สแกน QR บ่อยเกินไป",
    failClosed: false,
});
