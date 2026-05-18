/**
 * Rate limiting middleware สำหรับ Elysia
 * ใช้ Redis sliding window counter
 *
 * Policy สำคัญ (ตาม claude.md):
 *  login:       5 req / 60s  / IP+username
 *  otp/request: 3 req / 300s / account_id
 *  otp/verify:  5 req / otp_token
 *  scan preview: 120 req / 60s / account_id
 */
import { Elysia } from "elysia";
import { isRateLimited } from "./redis";
import { AppError } from "./errors";

export type RateLimitOptions = {
    limit: number;       // max requests
    windowSecs: number;  // time window
    keyFn: (ctx: { request: Request; headers: Record<string, string | undefined> }) => string;
    message?: string;
};

export function rateLimitPlugin(opts: RateLimitOptions) {
    return new Elysia({ name: `rate-limit:${opts.limit}:${opts.windowSecs}` })
        .onBeforeHandle(async ({ request, headers, set }) => {
            const key = opts.keyFn({ request, headers });
            const { limited, ttl } = await isRateLimited(key, opts.limit, opts.windowSecs);
            if (limited) {
                set.headers["Retry-After"] = String(ttl);
                set.status = 429;
                return {
                    success: false,
                    message: opts.message ?? `ทำรายการบ่อยเกินไป กรุณารอ ${ttl} วินาที`,
                };
            }
        });
}

// ── Pre-built rate limiters ────────────────────────────────────────────────────

/** Login: 5 req / 60s per IP+username */
export const loginRateLimit = rateLimitPlugin({
    limit: 5,
    windowSecs: 60,
    keyFn: ({ request }) => {
        const ip = request.headers.get("x-forwarded-for") ?? "unknown";
        return `login:${ip}`;
    },
    message: "พยายาม login บ่อยเกินไป กรุณารอ 1 นาที",
});

/** OTP request: 3 req / 300s per account */
export const otpRequestRateLimit = rateLimitPlugin({
    limit: 3,
    windowSecs: 300,
    keyFn: ({ request }) => {
        const ip = request.headers.get("x-forwarded-for") ?? "unknown";
        return `otp-req:${ip}`;
    },
    message: "ขอ OTP บ่อยเกินไป กรุณารอ 5 นาที",
});

/** OTP verify: 5 req / 300s per token (handled separately in service) */
export const otpVerifyRateLimit = rateLimitPlugin({
    limit: 10,
    windowSecs: 60,
    keyFn: ({ request }) => {
        const ip = request.headers.get("x-forwarded-for") ?? "unknown";
        return `otp-verify:${ip}`;
    },
    message: "พยายาม verify OTP บ่อยเกินไป",
});

/** Scan preview: 120 req / 60s per IP */
export const scanRateLimit = rateLimitPlugin({
    limit: 120,
    windowSecs: 60,
    keyFn: ({ request }) => {
        const ip = request.headers.get("x-forwarded-for") ?? "unknown";
        return `scan:${ip}`;
    },
    message: "สแกน QR บ่อยเกินไป",
});
