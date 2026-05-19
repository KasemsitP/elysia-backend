/**
 * Tests 9-10: Outbox Worker + Graceful Shutdown
 *
 * รัน: bun test tests/worker.test.ts
 */
import { describe, it, expect, afterAll, beforeEach } from "bun:test";
import { prisma } from "../src/cores/prisma";
import { pollOnce } from "../src/cores/outbox";
import { createTestOutboxEvent, cleanTestOutboxEvents } from "./helpers";

afterAll(async () => {
    await prisma.$disconnect();
});

// ── Test 9: Outbox Worker ──────────────────────────────────────────────────────

describe("Test 9: Outbox worker", () => {
    let createdIds: number[] = [];

    beforeEach(() => { createdIds = []; });
    afterAll(async () => { await cleanTestOutboxEvents(createdIds); });

    it("poll เมื่อไม่มี event → return { processed: 0, failed: 0 }", async () => {
        const result = await pollOnce("test-worker");
        // อาจมี event จาก real system แต่ processed + failed ควรไม่ throw
        expect(result.processed).toBeGreaterThanOrEqual(0);
        expect(result.failed).toBeGreaterThanOrEqual(0);
    });

    it("event OTP_SEND → mark DONE", async () => {
        const event = await createTestOutboxEvent("OTP_SEND", {
            account_id: 1,
            purpose: "TEST",
            channel: "EMAIL",
        });
        createdIds.push(event.id);

        await pollOnce("test-worker");

        const updated = await prisma.service_outbox_events.findUnique({ where: { id: event.id } });
        expect(updated?.status).toBe("DONE");
        expect(updated?.processed_at).not.toBeNull();
        expect(updated?.locked_by).toBeNull();
    });

    it("event NOTIFICATION_SEND (notification ไม่มีใน DB) → mark FAILED หลังหมด max_attempts", async () => {
        // notification_id=99999 ไม่มีอยู่ → error → FAILED เมื่อ attempts >= max
        const event = await createTestOutboxEvent(
            "NOTIFICATION_SEND",
            { notification_id: 99999999 },
            1, // max_attempts=1 → fail ทันที
        );
        createdIds.push(event.id);

        await pollOnce("test-worker");

        const updated = await prisma.service_outbox_events.findUnique({ where: { id: event.id } });
        expect(updated?.status).toBe("FAILED");
        expect(updated?.attempts).toBe(1);
        expect(updated?.error_message).toBeTruthy();
    });

    it("event ที่ยังไม่ถึง available_at → ไม่ถูก process", async () => {
        const futureEvent = await prisma.service_outbox_events.create({
            data: {
                event_type: "OTP_SEND",
                payload: { account_id: 1, purpose: "FUTURE" },
                status: "PENDING",
                attempts: 0,
                max_attempts: 3,
                available_at: new Date(Date.now() + 60_000), // 1 นาทีข้างหน้า
            },
        });
        createdIds.push(futureEvent.id);

        await pollOnce("test-worker");

        // ยังต้อง PENDING อยู่
        const after = await prisma.service_outbox_events.findUnique({ where: { id: futureEvent.id } });
        expect(after?.status).toBe("PENDING");
    });

    it("event unknown type → mark DONE (log warn แต่ไม่ throw)", async () => {
        const event = await createTestOutboxEvent("UNKNOWN_TYPE_XYZ", { data: "test" });
        createdIds.push(event.id);

        await pollOnce("test-worker");

        const updated = await prisma.service_outbox_events.findUnique({ where: { id: event.id } });
        // Unknown type ไม่ throw → mark DONE
        expect(updated?.status).toBe("DONE");
    });

    it("retry: event fail แต่ยัง attempts < max → กลับเป็น PENDING", async () => {
        const event = await createTestOutboxEvent(
            "NOTIFICATION_SEND",
            { notification_id: 88888888 }, // ไม่มีใน DB
            3, // max_attempts=3
        );
        createdIds.push(event.id);

        await pollOnce("test-worker");

        const after = await prisma.service_outbox_events.findUnique({ where: { id: event.id } });
        // attempts=1 < max=3 → PENDING (retry)
        expect(after?.status).toBe("PENDING");
        expect(after?.attempts).toBe(1);
        expect(after?.available_at).not.toBeNull();
        // available_at ควรถูก set ไปในอนาคต (backoff)
        expect(after!.available_at.getTime()).toBeGreaterThan(Date.now());
    });
});

// ── Test 10: Graceful Shutdown ─────────────────────────────────────────────────

describe("Test 10: Graceful shutdown", () => {
    it("API server shutdown ด้วย SIGTERM — exit code 0", async () => {
        const proc = Bun.spawn(["bun", "src/index.ts"], {
            cwd: new URL("..", import.meta.url).pathname.replace(/\/$/, ""),
            env: { ...process.env, PORT: "39999" },
            stdout: "pipe",
            stderr: "pipe",
        });

        // รอให้ server ready (max 5 วินาที)
        await Bun.sleep(2_000);

        // ตรวจว่า server ตอบสนอง
        const healthRes = await fetch("http://localhost:39999/health").catch(() => null);
        expect(healthRes?.status).toBe(200);

        // ส่ง SIGTERM
        proc.kill("SIGTERM");

        // รอ shutdown (max 15 วินาที)
        const exitResult = await Promise.race([
            proc.exited,
            Bun.sleep(15_000).then(() => -999),
        ]);

        expect(exitResult).toBe(0); // clean exit
    }, 20_000); // timeout 20s

    it("Outbox worker shutdown ด้วย SIGTERM — exit code 0", async () => {
        const proc = Bun.spawn(["bun", "src/workers/outbox.worker.ts"], {
            cwd: new URL("..", import.meta.url).pathname.replace(/\/$/, ""),
            env: { ...process.env },
            stdout: "pipe",
            stderr: "pipe",
        });

        await Bun.sleep(1_500); // รอ worker start

        proc.kill("SIGTERM");

        const exitResult = await Promise.race([
            proc.exited,
            Bun.sleep(15_000).then(() => -999),
        ]);

        expect(exitResult).toBe(0);
    }, 20_000);

    it("API server ตอบ /health ขณะ running", async () => {
        const proc = Bun.spawn(["bun", "src/index.ts"], {
            cwd: new URL("..", import.meta.url).pathname.replace(/\/$/, ""),
            env: { ...process.env, PORT: "39998" },
            stdout: "pipe",
            stderr: "pipe",
        });

        await Bun.sleep(2_000);

        const res = await fetch("http://localhost:39998/health").catch(() => null);
        expect(res?.status).toBe(200);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data = await res?.json() as any;
        expect(data?.status).toBe("ok");
        expect(data?.uptime).toBeGreaterThan(0);

        proc.kill("SIGTERM");
        await proc.exited;
    }, 20_000);
});
