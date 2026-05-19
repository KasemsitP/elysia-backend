/**
 * Integration Tests — Scenarios 1-7
 *
 * รัน: bun test tests/api.test.ts
 *
 * ต้องการ: DB connection ที่ใช้งานได้, .env ตั้งค่าแล้ว
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "bun:test";
import { prisma } from "../src/cores/prisma";
import { _testResetMemStore } from "../src/cores/rate-limit";
import {
    TestClient,
    createTestAccount,
    cleanTestAccounts,
} from "./helpers";

// ── Test accounts ─────────────────────────────────────────────────────────────

let adminId: number;
let staffId: number;
let graderId: number;
let inactiveId: number;
const PASSWORD = "TestPass@123";

beforeAll(async () => {
    // สร้าง test accounts โดยตรงใน DB (ไม่ผ่าน API)
    const admin    = await createTestAccount({ username: "admin_a1",    role_id: 1 });
    const staff    = await createTestAccount({ username: "staff_a1",    role_id: 2 });
    const grader   = await createTestAccount({ username: "grader_a1",   role_id: 4 });
    const inactive = await createTestAccount({ username: "inactive_a1", role_id: 1, active: false });
    adminId    = admin.id;
    staffId    = staff.id;
    graderId   = grader.id;
    inactiveId = inactive.id;
});

afterAll(async () => {
    await cleanTestAccounts();
    await prisma.$disconnect();
});

beforeEach(() => {
    _testResetMemStore(); // reset in-memory rate limit ก่อนทุก test
});

// ── 1. Login สำเร็จ → ได้ sid cookie ─────────────────────────────────────────

describe("Test 1: Login สำเร็จ", () => {
    it("ควรได้ status 200 และ sid cookie", async () => {
        const client = new TestClient();
        const { status, data } = await client.request("POST", "/api/auth/login", {
            body: { username: "__test__admin_a1", password: PASSWORD },
        });

        expect(status).toBe(200);
        expect(data?.message).toBe("ล็อคอินสำเร็จ");
        expect(client.sid).toBeTruthy();
        expect(client.sid?.length).toBeGreaterThan(10);
    });

    it("รหัสผ่านผิด → 401", async () => {
        const client = new TestClient();
        const { status } = await client.request("POST", "/api/auth/login", {
            body: { username: "__test__admin_a1", password: "WrongPassword" },
        });
        expect(status).toBe(401);
    });

    it("ชื่อผู้ใช้ไม่มีอยู่ → 401", async () => {
        const client = new TestClient();
        const { status } = await client.request("POST", "/api/auth/login", {
            body: { username: "nonexistent_user_x99", password: PASSWORD },
        });
        expect(status).toBe(401);
    });
});

// ── 2. POST โดยไม่มี CSRF → 403 ──────────────────────────────────────────────

describe("Test 2: POST ไม่มี CSRF token", () => {
    it("mutation ที่มี session แต่ไม่มี X-CSRF-Token → 403", async () => {
        const client = new TestClient();
        // Login ก่อน
        await client.request("POST", "/api/auth/login", {
            body: { username: "__test__admin_a1", password: PASSWORD },
        });
        // POST logout โดยไม่ส่ง CSRF
        const { status, data } = await client.request("POST", "/api/auth/logout");
        expect(status).toBe(403);
        expect(data?.message).toMatch(/CSRF/i);
    });

    it("mutation ที่ไม่มี session → ไม่ต้องการ CSRF (จะ 401 จาก auth guard แทน)", async () => {
        const client = new TestClient();
        // ไม่ login → ไม่มี session → CSRF ไม่เช็ค → auth guard โดน
        const { status } = await client.request("POST", "/api/subjects", {
            body: { code: "X99", name: "test" },
        });
        // คาด 401 (ไม่ใช่ 403 CSRF)
        expect(status).toBe(401);
    });

    it("POST /api/auth/login ไม่ต้อง CSRF (exempt)", async () => {
        const client = new TestClient();
        const { status } = await client.request("POST", "/api/auth/login", {
            body: { username: "__test__admin_a1", password: PASSWORD },
        });
        // ถ้า exempt ทำงานถูก จะ login ได้ปกติ (ไม่ 403)
        expect(status).not.toBe(403);
    });
});

// ── 3. POST พร้อม CSRF → ผ่าน ───────────────────────────────────────────────

describe("Test 3: POST พร้อม CSRF token", () => {
    it("GET csrf-token แล้วใช้กับ mutation → ผ่าน", async () => {
        const client = new TestClient();
        // Login
        await client.request("POST", "/api/auth/login", {
            body: { username: "__test__admin_a1", password: PASSWORD },
        });
        // ขอ CSRF
        const csrfRes = await client.request("GET", "/api/csrf-token");
        expect(csrfRes.status).toBe(200);
        const token = csrfRes.headers.get("x-csrf-token") ?? csrfRes.data?.data?.csrf_token;
        expect(token).toBeTruthy();

        // POST logout พร้อม CSRF
        const { status } = await client.request("POST", "/api/auth/logout", {
            headers: { "X-CSRF-Token": token },
        });
        expect(status).toBe(200);
    });

    it("CSRF token หมดอายุ/ปลอม → 403", async () => {
        const client = new TestClient();
        await client.request("POST", "/api/auth/login", {
            body: { username: "__test__admin_a1", password: PASSWORD },
        });
        // ใช้ token ปลอม
        const { status } = await client.request("POST", "/api/auth/logout", {
            headers: { "X-CSRF-Token": "fake.token.here" },
        });
        expect(status).toBe(403);
    });
});

// ── 4. User inactive/deleted → session ใช้ไม่ได้ ────────────────────────────

describe("Test 4: Account inactive/deleted invalidates session", () => {
    it("login แล้ว deactivate account → session ถูก reject", async () => {
        const client = new TestClient();
        // Login ด้วย inactive account
        const { status } = await client.request("POST", "/api/auth/login", {
            body: { username: "__test__inactive_a1", password: PASSWORD },
        });
        // บัญชีปิดอยู่ → ไม่ควร login ได้
        expect(status).toBe(401);
    });

    it("login แล้ว activate account ถูก deactivate ทีหลัง → request ถัดไป 401", async () => {
        // สร้าง account ชั่วคราว
        const tmp = await createTestAccount({ username: `tmp_${Date.now()}`, role_id: 2 });
        const client = new TestClient();

        // Login
        await client.request("POST", "/api/auth/login", {
            body: { username: tmp.username, password: PASSWORD },
        });
        expect(client.sid).toBeTruthy();

        // ดึง CSRF
        const csrfRes = await client.request("GET", "/api/csrf-token");
        const token = csrfRes.headers.get("x-csrf-token") ?? csrfRes.data?.data?.csrf_token;
        expect(csrfRes.status).toBe(200);

        // Deactivate account โดยตรงใน DB
        await prisma.accounts.update({
            where: { id: tmp.id },
            data: { active: false },
        });

        // Request หลัง deactivate → session check พบว่า account ไม่ active → 401
        const { status } = await client.request("GET", "/api/auth/me");
        expect(status).toBe(401);

        // Cleanup
        await prisma.accounts.delete({ where: { id: tmp.id } });
    });
});

// ── 5. Role ผิด → 403 ────────────────────────────────────────────────────────

describe("Test 5: Role-based access control", () => {
    it("GRADER เข้า /api/reports → 403", async () => {
        const client = new TestClient();
        await client.request("POST", "/api/auth/login", {
            body: { username: "__test__grader_a1", password: PASSWORD },
        });
        const { status } = await client.request("GET", "/api/reports/campaigns/1/score-summary");
        expect(status).toBe(403);
    });

    it("STAFF ลบ subject (ADMIN-only) → 403", async () => {
        const client = new TestClient();
        await client.request("POST", "/api/auth/login", {
            body: { username: "__test__staff_a1", password: PASSWORD },
        });
        const { status } = await client.mutate("DELETE", "/api/subjects/99999");
        expect(status).toBe(403);
    });

    it("ไม่มี session → 401 (ไม่ใช่ 403)", async () => {
        const client = new TestClient();
        const { status } = await client.request("GET", "/api/campaigns");
        expect(status).toBe(401);
    });

    it("ADMIN เข้าทุก endpoint ที่ทดสอบได้ → ไม่โดน 403 role error", async () => {
        const client = new TestClient();
        await client.request("POST", "/api/auth/login", {
            body: { username: "__test__admin_a1", password: PASSWORD },
        });
        const { status } = await client.request("GET", "/api/campaigns");
        // อาจ 200 หรือ error อื่น แต่ไม่ควรเป็น 403
        expect(status).not.toBe(403);
    });
});

// ── 6. Login rate limit ────────────────────────────────────────────────────────

describe("Test 6: Login rate limit", () => {
    it("Login ผิด 5 ครั้งจาก IP เดียวกัน → ครั้งที่ 6 ได้ 429", async () => {
        const testIp = `10.0.0.${Math.floor(Math.random() * 250) + 1}`;

        // ยิง 5 ครั้ง (limit = 5)
        for (let i = 0; i < 5; i++) {
            await new TestClient().request("POST", "/api/auth/login", {
                body: { username: "no_such_user", password: "wrong" },
                ip: testIp,
            });
        }

        // ครั้งที่ 6 → 429
        const { status, data } = await new TestClient().request("POST", "/api/auth/login", {
            body: { username: "no_such_user", password: "wrong" },
            ip: testIp,
        });

        expect(status).toBe(429);
        expect(data?.message).toMatch(/บ่อยเกินไป/);
    });

    it("IP ต่างกัน → ไม่โดน limit จากกัน", async () => {
        const ip1 = "10.1.2.3";
        const ip2 = "10.4.5.6";

        // 5 requests จาก ip1
        for (let i = 0; i < 5; i++) {
            await new TestClient().request("POST", "/api/auth/login", {
                body: { username: "no_such_user_ip", password: "wrong" },
                ip: ip1,
            });
        }

        // ip2 ยังไม่โดน limit
        const { status } = await new TestClient().request("POST", "/api/auth/login", {
            body: { username: "no_such_user_ip", password: "wrong" },
            ip: ip2,
        });
        expect(status).not.toBe(429);
    });
});

// ── 7. OTP rate limit ─────────────────────────────────────────────────────────

describe("Test 7: OTP rate limit", () => {
    it("ขอ OTP เกิน limit → 429", async () => {
        // Login ก่อน
        const client = new TestClient();
        await client.request("POST", "/api/auth/login", {
            body: { username: "__test__admin_a1", password: PASSWORD },
        });
        const csrfRes = await client.request("GET", "/api/csrf-token");
        const token = csrfRes.headers.get("x-csrf-token") ?? csrfRes.data?.data?.csrf_token;

        const otpIp = `10.99.${Math.floor(Math.random() * 200)}.1`;

        // OTP limit = 3 requests / 300s
        for (let i = 0; i < 3; i++) {
            await client.request("POST", "/api/otp/request", {
                body: { account_id: adminId, purpose: "TEST_OTP" },
                headers: { "X-CSRF-Token": token },
                ip: otpIp,
            });
        }

        // ครั้งที่ 4 → 429
        const { status } = await client.request("POST", "/api/otp/request", {
            body: { account_id: adminId, purpose: "TEST_OTP" },
            headers: { "X-CSRF-Token": token },
            ip: otpIp,
        });
        expect(status).toBe(429);
    });
});
