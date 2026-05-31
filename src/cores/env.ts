import "dotenv/config";

// ── Env validation — crash fast ที่ startup ────────────────────────────────────
function required(key: string): string {
    const val = process.env[key];
    if (!val) throw new Error(`[env] Missing required environment variable: ${key}`);
    return val;
}

function optional(key: string, fallback: string): string {
    return process.env[key] ?? fallback;
}

function optionalNumber(key: string, fallback: number): number {
    const val = process.env[key];
    if (!val) return fallback;
    const n = Number(val);
    if (!Number.isFinite(n)) throw new Error(`[env] ${key} must be a number, got: "${val}"`);
    return n;
}

export const env = {
    DATABASE_URL:       required("DATABASE_URL"),
    JWT_SECRET:         required("JWT_SECRET"),
    CSRF_SECRET:        optional("CSRF_SECRET", required("JWT_SECRET")),
    PORT:               optionalNumber("PORT", 3000),
    REDIS_URL:          optional("REDIS_URL", "redis://localhost:6379"),
    FRONTEND_URL:       optional("FRONTEND_URL", "*"),
    NODE_ENV:           optional("NODE_ENV", "development"),
    STORAGE_DIR:        optional("STORAGE_DIR", "./storage"),
} as const;

export type Env = typeof env;
