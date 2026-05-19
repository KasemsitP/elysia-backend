/**
 * Structured logger — JSON format for production, pretty for dev
 *
 * ใช้: logger.info("message", { extra: "data" })
 * หรือ: logger.error("failed", error)
 */
import { env } from "./env";

type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

const LEVEL_NUM: Record<LogLevel, number> = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };
const MIN_LEVEL: LogLevel = (env.NODE_ENV === "production") ? "INFO" : "DEBUG";

function shouldLog(level: LogLevel): boolean {
    return LEVEL_NUM[level] >= LEVEL_NUM[MIN_LEVEL];
}

function write(level: LogLevel, message: string, context?: unknown, error?: unknown) {
    if (!shouldLog(level)) return;

    const entry = {
        ts: new Date().toISOString(),
        level,
        msg: message,
        ...(context !== undefined && { ctx: context }),
        ...(error !== undefined && {
            err: error instanceof Error
                ? { name: error.name, message: error.message, stack: env.NODE_ENV !== "production" ? error.stack : undefined }
                : String(error),
        }),
    };

    if (env.NODE_ENV === "production") {
        // JSON ต่อ line สำหรับ log aggregator (Railway, Datadog)
        console.log(JSON.stringify(entry));
    } else {
        // Pretty print สำหรับ dev
        const colors: Record<LogLevel, string> = { DEBUG: "\x1b[36m", INFO: "\x1b[32m", WARN: "\x1b[33m", ERROR: "\x1b[31m" };
        const reset = "\x1b[0m";
        const lvl = `${colors[level]}[${level}]${reset}`;
        const ts = `\x1b[90m${entry.ts}\x1b[0m`;
        console.log(`${ts} ${lvl} ${message}`);
        if (context !== undefined) console.log("  ctx:", context);
        if (error !== undefined) console.log("  err:", error);
    }
}

export const logger = {
    debug: (msg: string, ctx?: unknown) => write("DEBUG", msg, ctx),
    info:  (msg: string, ctx?: unknown) => write("INFO",  msg, ctx),
    warn:  (msg: string, ctx?: unknown) => write("WARN",  msg, ctx),
    error: (msg: string, err?: unknown, ctx?: unknown) => write("ERROR", msg, ctx, err),

    // Request logger middleware helper
    request: (method: string, path: string, status: number, ms: number) =>
        write(status >= 500 ? "ERROR" : status >= 400 ? "WARN" : "INFO",
            `${method} ${path} ${status} ${ms}ms`,
        ),
};
