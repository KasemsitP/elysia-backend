/**
 * Redis client wrapper — ใช้ ioredis
 * ติดตั้ง: bun add ioredis
 * ถ้าไม่ได้ install → fail-open (rate limit/cache disabled, ระบบยังทำงานได้)
 */
import { env } from "./env";

// ใช้ unknown เพื่อหลีกเลี่ยง dependency บน @types/ioredis ที่อาจยังไม่ install
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _redis: any = null;
let _available = false;

function init() {
    if (_redis !== null) return;
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const Redis = require("ioredis");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        _redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: 2, enableReadyCheck: true, lazyConnect: true });
        _redis.on("error", (err: Error) => {
            _available = false;
            console.warn("[Redis] error:", err.message);
        });
        _redis.on("ready", () => { _available = true; });
        _available = true;
    } catch {
        console.warn("[Redis] ioredis not available — run: bun add ioredis");
        _redis = {}; // prevent re-init
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function r(): any | null {
    init();
    return _available ? _redis : null;
}

export async function redisClose(): Promise<void> {
    if (_available && _redis?.quit) await _redis.quit();
}

// ── Rate limit (sliding window) ────────────────────────────────────────────────

export async function isRateLimited(
    key: string,
    limit: number,
    windowSecs: number,
): Promise<{ limited: boolean; count: number; ttl: number }> {
    const redis = r();
    if (!redis) return { limited: false, count: 0, ttl: 0 };

    try {
        const now = Date.now();
        const rk = `rl:${key}`;
        await redis.zremrangebyscore(rk, "-inf", now - windowSecs * 1000);
        const count: number = await redis.zcard(rk);
        if (count >= limit) {
            const ttl: number = await redis.ttl(rk);
            return { limited: true, count, ttl };
        }
        await redis.multi()
            .zadd(rk, now, `${now}-${Math.random()}`)
            .expire(rk, windowSecs)
            .exec();
        return { limited: false, count: count + 1, ttl: windowSecs };
    } catch {
        return { limited: false, count: 0, ttl: 0 };
    }
}

// ── Cache helpers ─────────────────────────────────────────────────────────────

export async function cacheGet<T>(key: string): Promise<T | null> {
    const redis = r();
    if (!redis) return null;
    try {
        const val: string | null = await redis.get(key);
        return val ? (JSON.parse(val) as T) : null;
    } catch { return null; }
}

export async function cacheSet(key: string, value: unknown, ttlSecs: number): Promise<void> {
    const redis = r();
    if (!redis) return;
    try { await redis.set(key, JSON.stringify(value), "EX", ttlSecs); } catch { /* fail silently */ }
}

export async function cacheDel(key: string): Promise<void> {
    const redis = r();
    if (!redis) return;
    try { await redis.del(key); } catch { /* fail silently */ }
}
