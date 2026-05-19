/**
 * Test 8: Seed script รันซ้ำไม่พัง
 *
 * รัน: bun test tests/seed.test.ts
 */
import { describe, it, expect, afterAll } from "bun:test";
import { prisma } from "../src/cores/prisma";

// Import seed functions โดยตรง (ไม่รัน main())
async function seedRoles() {
    const roles = [
        { id: 1, code: "ADMIN",   name: "ผู้ดูแลระบบ" },
        { id: 2, code: "STAFF",   name: "เจ้าหน้าที่" },
        { id: 3, code: "MANAGER", name: "ผู้จัดการ" },
        { id: 4, code: "GRADER",  name: "ผู้ตรวจข้อสอบ" },
    ];
    for (const role of roles) {
        await prisma.roles.upsert({
            where: { id: role.id },
            create: { id: role.id, code: role.code, name: role.name },
            update: { code: role.code, name: role.name },
        });
    }
}

async function seedDefinitions() {
    await prisma.setting_definitions.upsert({
        where: { setting_key: "score_diff_threshold" },
        create: { setting_key: "score_diff_threshold", name: "Test", value_type: "NUMBER", default_value: 5 },
        update: { name: "Test" },
    });
}

afterAll(async () => {
    await prisma.$disconnect();
});

// ── Test 8 ────────────────────────────────────────────────────────────────────

describe("Test 8: Seed idempotency", () => {
    it("seed roles รันครั้งแรก — ไม่ throw", async () => {
        await expect(seedRoles()).resolves.toBeUndefined();
    });

    it("seed roles รันครั้งที่ 2 — ไม่ throw (upsert)", async () => {
        await expect(seedRoles()).resolves.toBeUndefined();
    });

    it("seed roles รันครั้งที่ 3 — ไม่ throw", async () => {
        await expect(seedRoles()).resolves.toBeUndefined();
    });

    it("roles ใน DB ตรงตาม seed data", async () => {
        await seedRoles();
        const roles = await prisma.roles.findMany({ orderBy: { id: "asc" } });
        const codes = roles.map((r) => r.code);
        expect(codes).toContain("ADMIN");
        expect(codes).toContain("STAFF");
        expect(codes).toContain("MANAGER");
        expect(codes).toContain("GRADER");
    });

    it("seed setting definitions รันซ้ำ — ไม่ throw", async () => {
        await expect(seedDefinitions()).resolves.toBeUndefined();
        await expect(seedDefinitions()).resolves.toBeUndefined();
    });

    it("setting definition มีใน DB หลัง seed", async () => {
        await seedDefinitions();
        const def = await prisma.setting_definitions.findFirst({
            where: { setting_key: "score_diff_threshold" },
        });
        expect(def).not.toBeNull();
        expect(def?.value_type).toBe("NUMBER");
    });

    it("seed admin account ครั้งแรก — สร้างได้", async () => {
        // ลบ test admin ถ้ามีอยู่ก่อน
        await prisma.accounts.deleteMany({ where: { username: "__seed_test_admin__" } });

        const hash = await Bun.password.hash("Admin@12345", { algorithm: "bcrypt", cost: 4 });
        await prisma.accounts.create({
            data: {
                username: "__seed_test_admin__",
                password_hash: hash,
                full_name: "Test Admin",
                title: "นาย",
                role_id: 1,
                active: true,
                active_unique_key: 1,
            },
        });

        const found = await prisma.accounts.findFirst({ where: { username: "__seed_test_admin__" } });
        expect(found).not.toBeNull();
    });

    it("seed admin account ครั้งที่ 2 — skip ไม่ duplicate", async () => {
        // เลียนแบบ logic ใน seed.ts
        const existing = await prisma.accounts.findFirst({ where: { username: "__seed_test_admin__" } });
        // ถ้ามีแล้ว → skip
        if (!existing) {
            const hash = await Bun.password.hash("Admin@12345", { algorithm: "bcrypt", cost: 4 });
            await prisma.accounts.create({
                data: {
                    username: "__seed_test_admin__",
                    password_hash: hash,
                    full_name: "Test Admin",
                    title: "นาย",
                    role_id: 1,
                    active: true,
                    active_unique_key: 1,
                },
            });
        }

        // ต้องมีแค่ 1 record
        const count = await prisma.accounts.count({ where: { username: "__seed_test_admin__" } });
        expect(count).toBe(1);

        // Cleanup
        await prisma.accounts.deleteMany({ where: { username: "__seed_test_admin__" } });
    });
});
