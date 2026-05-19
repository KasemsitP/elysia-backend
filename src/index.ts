import { app } from "./app";
import { env } from "./cores/env";
import { prisma } from "./cores/prisma";
import { redisClose } from "./cores/redis";
import { logger } from "./cores/logger";

// ── Startup ───────────────────────────────────────────────────────────────────

logger.info(`[Server] starting on port ${env.PORT}`, { env: env.NODE_ENV });

const server = app.listen(env.PORT, ({ hostname, port }) => {
    logger.info(`[Server] ready`, { url: `http://${hostname}:${port}`, pid: process.pid });
});

// ── Graceful Shutdown ─────────────────────────────────────────────────────────

let isShuttingDown = false;

async function shutdown(signal: string) {
    if (isShuttingDown) return;
    isShuttingDown = true;

    logger.info(`[Server] received ${signal}, shutting down gracefully...`);

    // 1. Stop accepting new connections
    server.stop(true);
    logger.info("[Server] HTTP server stopped");

    // 2. Give in-flight requests time to finish (max 10s)
    await Bun.sleep(Math.min(10_000, 5_000));

    // 3. Close DB connection
    try {
        await prisma.$disconnect();
        logger.info("[Server] Prisma disconnected");
    } catch (err) {
        logger.error("[Server] Prisma disconnect error", err);
    }

    // 4. Close Redis
    try {
        await redisClose();
        logger.info("[Server] Redis disconnected");
    } catch (err) {
        logger.error("[Server] Redis disconnect error", err);
    }

    logger.info("[Server] shutdown complete");
    process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));
process.on("uncaughtException", (err) => {
    logger.error("[Server] uncaughtException", err);
    shutdown("uncaughtException");
});
process.on("unhandledRejection", (reason) => {
    logger.error("[Server] unhandledRejection", reason);
    shutdown("unhandledRejection");
});
