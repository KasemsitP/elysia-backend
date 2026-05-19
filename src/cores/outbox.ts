/**
 * Outbox core logic — แยกออกมาเพื่อ testability
 * worker เรียก pollOnce() ใน loop
 * tests เรียก pollOnce() โดยตรง
 */
import { type PrismaClient } from "../generated/prisma/client";
import { prisma as defaultPrisma } from "./prisma";
import { logger } from "./logger";

const BATCH_SIZE = 10;
const LOCK_TIMEOUT_MINS = 5;

// ── Event Processors ──────────────────────────────────────────────────────────

async function processOtpSend(payload: Record<string, unknown>, _db: PrismaClient) {
    logger.info("[Outbox] OTP_SEND", { account_id: payload.account_id, purpose: payload.purpose });
    // Production: ส่ง email จริงผ่าน SES/SendGrid
}

async function processNotificationSend(payload: Record<string, unknown>, db: PrismaClient) {
    const notificationId = payload.notification_id as number;
    await db.notification_messages.update({
        where: { id: notificationId },
        data: { status: "SENT", sent_at: new Date() },
    });
    await db.notification_recipients.updateMany({
        where: { notification_id: notificationId, delivery_status: "PENDING" },
        data: { delivery_status: "DELIVERED" },
    });
    logger.info("[Outbox] NOTIFICATION_SEND", { notification_id: notificationId });
}

async function processCampaignUnlock(payload: Record<string, unknown>, _db: PrismaClient) {
    logger.info("[Outbox] CAMPAIGN_UNLOCK", { campaign_id: payload.campaignId });
}

async function processEvent(
    eventId: number,
    eventType: string,
    payload: unknown,
    db: PrismaClient,
): Promise<void> {
    const p = payload as Record<string, unknown>;
    switch (eventType) {
        case "OTP_SEND":          await processOtpSend(p, db);          break;
        case "NOTIFICATION_SEND": await processNotificationSend(p, db); break;
        case "CAMPAIGN_UNLOCK":   await processCampaignUnlock(p, db);   break;
        default:
            logger.warn(`[Outbox] Unknown event_type: ${eventType} (id=${eventId})`);
    }
}

// ── Main poll function (exported for testing) ─────────────────────────────────

export async function pollOnce(
    workerId: string = "outbox-test",
    db: PrismaClient = defaultPrisma,
): Promise<{ processed: number; failed: number }> {
    const lockExpiry = new Date(Date.now() - LOCK_TIMEOUT_MINS * 60 * 1000);

    const events = await db.$queryRaw<
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

    if (events.length === 0) return { processed: 0, failed: 0 };

    const ids = events.map((e) => e.id);
    await db.service_outbox_events.updateMany({
        where: { id: { in: ids } },
        data: { status: "PROCESSING", locked_at: new Date(), locked_by: workerId },
    });

    let processed = 0;
    let failed = 0;

    for (const event of events) {
        try {
            await processEvent(event.id, event.event_type, event.payload, db);
            await db.service_outbox_events.update({
                where: { id: event.id },
                data: { status: "DONE", processed_at: new Date(), locked_by: null },
            });
            processed++;
        } catch (err) {
            const newAttempts = event.attempts + 1;
            const isFinalFailure = newAttempts >= event.max_attempts;
            const backoffMs = Math.min(Math.pow(2, newAttempts) * 60_000, 60 * 60_000);
            await db.service_outbox_events.update({
                where: { id: event.id },
                data: {
                    status: isFinalFailure ? "FAILED" : "PENDING",
                    attempts: { increment: 1 },
                    error_message: String(err),
                    locked_at: null,
                    locked_by: null,
                    available_at: new Date(Date.now() + backoffMs),
                },
            });
            logger.error(`[Outbox] event ${event.id} failed`, err);
            failed++;
        }
    }

    return { processed, failed };
}
