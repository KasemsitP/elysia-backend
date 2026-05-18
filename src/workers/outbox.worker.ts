/**
 * Outbox Worker — ประมวลผล service_outbox_events
 *
 * รันแยกจาก main server:
 *   bun src/workers/outbox.worker.ts
 *
 * Flow:
 * 1. Poll PENDING events (SELECT FOR UPDATE)
 * 2. Mark PROCESSING + locked_by + locked_at
 * 3. Process แต่ละ event_type
 * 4. Mark DONE หรือ FAILED (retry ถ้า attempts < max_attempts)
 *
 * Event types:
 *  OTP_SEND          → ส่ง OTP ทาง email/SMS
 *  NOTIFICATION_SEND → ส่ง notification ไปยัง recipients
 *  CAMPAIGN_UNLOCK   → ส่ง notification ว่า campaign unlocked
 */
import { PrismaClient } from "../generated/prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

const WORKER_ID = `outbox-${process.pid}`;
const POLL_INTERVAL_MS = 5_000;       // poll ทุก 5 วินาที
const BATCH_SIZE = 10;                // ครั้งละ 10 events
const LOCK_TIMEOUT_MINS = 5;          // event ที่ lock นานกว่า 5 นาที ถือว่า stale

const dbUrl = new URL(process.env.DATABASE_URL!);
dbUrl.searchParams.set("allowPublicKeyRetrieval", "true");
const adapter = new PrismaMariaDb(dbUrl.toString());
const prisma = new PrismaClient({ adapter });

// ── Event Processors ──────────────────────────────────────────────────────────

async function processOtpSend(payload: Record<string, unknown>) {
    // ในระบบจริง: ส่ง email ด้วย nodemailer / AWS SES / SendGrid
    // ตอนนี้ log เพื่อ development
    console.log(`[OTP_SEND] account_id=${payload.account_id} purpose=${payload.purpose} channel=${payload.channel}`);
    // ตัวอย่าง: await sendEmail(payload.target, generateOtpEmailHtml(payload));
}

async function processNotificationSend(payload: Record<string, unknown>) {
    const notificationId = payload.notification_id as number;
    // อัปเดต status เป็น SENT
    await prisma.notification_messages.update({
        where: { id: notificationId },
        data: { status: "SENT", sent_at: new Date() },
    });
    // อัปเดต recipients delivery_status
    await prisma.notification_recipients.updateMany({
        where: { notification_id: notificationId, delivery_status: "PENDING" },
        data: { delivery_status: "DELIVERED" },
    });
    console.log(`[NOTIFICATION_SEND] notification_id=${notificationId}`);
}

async function processCampaignUnlock(payload: Record<string, unknown>) {
    console.log(`[CAMPAIGN_UNLOCK] campaign_id=${payload.campaignId} at ${payload.unlockedAt}`);
    // ในระบบจริง: ส่ง notification ไปยัง staff ทุกคนว่า campaign ถูก unlock แล้ว
}

// ── Event Dispatcher ──────────────────────────────────────────────────────────

async function processEvent(eventId: number, eventType: string, payload: unknown): Promise<void> {
    const p = payload as Record<string, unknown>;
    switch (eventType) {
        case "OTP_SEND":          await processOtpSend(p); break;
        case "NOTIFICATION_SEND": await processNotificationSend(p); break;
        case "CAMPAIGN_UNLOCK":   await processCampaignUnlock(p); break;
        default:
            console.warn(`[Outbox] Unknown event_type: ${eventType} (id=${eventId})`);
    }
}

// ── Main Poll Loop ────────────────────────────────────────────────────────────

async function pollOnce() {
    const lockExpiry = new Date(Date.now() - LOCK_TIMEOUT_MINS * 60 * 1000);

    // ดึง PENDING events ที่ available_at <= now และยังไม่ถูก lock (หรือ lock stale)
    const events = await prisma.$queryRaw<
        Array<{ id: number; event_type: string; payload: unknown; attempts: number; max_attempts: number }>
    >`
        SELECT id, event_type, payload, attempts, max_attempts
        FROM service_outbox_events
        WHERE status = 'PENDING'
          AND available_at <= NOW()
          AND (locked_at IS NULL OR locked_at < ${lockExpiry})
        ORDER BY id ASC
        LIMIT ${BATCH_SIZE}
        FOR UPDATE SKIP LOCKED
    `;

    if (events.length === 0) return;

    // Mark events as PROCESSING
    const ids = events.map((e) => e.id);
    await prisma.service_outbox_events.updateMany({
        where: { id: { in: ids } },
        data: { status: "PROCESSING", locked_at: new Date(), locked_by: WORKER_ID },
    });

    for (const event of events) {
        try {
            await processEvent(event.id, event.event_type, event.payload);
            await prisma.service_outbox_events.update({
                where: { id: event.id },
                data: { status: "DONE", processed_at: new Date(), locked_by: null },
            });
        } catch (err) {
            const newAttempts = event.attempts + 1;
            const failed = newAttempts >= event.max_attempts;
            // exponential backoff: available_at = now + 2^attempts minutes
            const backoffMs = Math.min(Math.pow(2, newAttempts) * 60_000, 60 * 60_000);
            await prisma.service_outbox_events.update({
                where: { id: event.id },
                data: {
                    status: failed ? "FAILED" : "PENDING",
                    attempts: { increment: 1 },
                    error_message: String(err),
                    locked_at: null,
                    locked_by: null,
                    available_at: new Date(Date.now() + backoffMs),
                },
            });
            console.error(`[Outbox] event ${event.id} (${event.event_type}) failed (attempt ${newAttempts}):`, err);
        }
    }
}

async function main() {
    console.log(`[Outbox Worker] started pid=${process.pid} worker_id=${WORKER_ID}`);
    while (true) {
        try {
            await pollOnce();
        } catch (err) {
            console.error("[Outbox Worker] poll error:", err);
        }
        await Bun.sleep(POLL_INTERVAL_MS);
    }
}

main().catch((err) => {
    console.error("[Outbox Worker] fatal:", err);
    process.exit(1);
});
