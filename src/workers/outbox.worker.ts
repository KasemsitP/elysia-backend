/**
 * Outbox Worker — ประมวลผล service_outbox_events
 * รันแยกจาก main server: bun run worker:outbox
 *
 * Core logic อยู่ใน src/cores/outbox.ts (testable)
 */
import { PrismaClient } from "../generated/prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { pollOnce } from "../cores/outbox";

const WORKER_ID      = `outbox-${process.pid}`;
const POLL_INTERVAL_MS = 5_000;

const dbUrl = new URL(process.env.DATABASE_URL!);
dbUrl.searchParams.set("allowPublicKeyRetrieval", "true");
const adapter = new PrismaMariaDb(dbUrl.toString());
const prisma  = new PrismaClient({ adapter });

let _running = true;

async function main() {
    console.log(`[Outbox Worker] started pid=${process.pid} id=${WORKER_ID}`);
    while (_running) {
        try {
            const { processed, failed } = await pollOnce(WORKER_ID, prisma as never);
            if (processed + failed > 0) {
                console.log(`[Outbox Worker] processed=${processed} failed=${failed}`);
            }
        } catch (err) {
            console.error("[Outbox Worker] poll error:", err);
        }
        if (_running) await Bun.sleep(POLL_INTERVAL_MS);
    }
}

async function shutdown(signal: string) {
    console.log(`[Outbox Worker] ${signal} — stopping after current batch...`);
    _running = false;
    await Bun.sleep(Math.min(10_000, POLL_INTERVAL_MS));
    try { await prisma.$disconnect(); } catch { /* */ }
    console.log("[Outbox Worker] shutdown complete");
    process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));

main().catch((err) => {
    console.error("[Outbox Worker] fatal:", err);
    process.exit(1);
});
