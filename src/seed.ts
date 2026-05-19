/**
 * Seed script — รัน: bun src/seed.ts
 *
 * สร้าง:
 * 1. Roles (ADMIN, STAFF, MANAGER, GRADER)
 * 2. Default ADMIN account
 * 3. Setting definitions (score_diff_threshold, passing_quota, etc.)
 */
import "dotenv/config";
import { PrismaClient } from "./generated/prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

const dbUrl = new URL(process.env.DATABASE_URL!);
dbUrl.searchParams.set("allowPublicKeyRetrieval", "true");
const adapter = new PrismaMariaDb(dbUrl.toString());
const prisma = new PrismaClient({ adapter });

// ── 1. Roles ──────────────────────────────────────────────────────────────────

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
    console.log("✓ Roles seeded");
}

// ── 2. Default ADMIN account ──────────────────────────────────────────────────

async function seedAdminAccount() {
    const existing = await prisma.accounts.findFirst({ where: { username: "admin" } });
    if (existing) {
        console.log("✓ Admin account already exists — skipping");
        return;
    }

    const password = process.env.ADMIN_INITIAL_PASSWORD ?? "Admin@12345";
    const hashedPassword = await Bun.password.hash(password, { algorithm: "bcrypt", cost: 10 });

    await prisma.accounts.create({
        data: {
            username: "admin",
            password_hash: hashedPassword,
            full_name: "System Administrator",
            title: "นาย",
            email: process.env.ADMIN_EMAIL ?? "admin@system.local",
            role_id: 1, // ADMIN
            active: true,
            active_unique_key: 1,
        },
    });
    console.log(`✓ Admin account created — username: admin / password: ${password}`);
    console.log("  ⚠️  เปลี่ยน password ทันทีหลัง deploy!");
}

// ── 3. Setting Definitions ────────────────────────────────────────────────────

async function seedSettingDefinitions() {
    const definitions = [
        {
            setting_key: "score_diff_threshold",
            name: "เกณฑ์ความต่างคะแนน (DISPUTED)",
            description: "ถ้าผู้ตรวจ 2 คนต่างกันเกินค่านี้ → DISPUTED",
            value_type: "NUMBER",
            scope: "CAMPAIGN",
            default_value: 5,
            required: false,
        },
        {
            setting_key: "passing_quota",
            name: "จำนวนผู้ผ่าน (QUOTA)",
            description: "จำนวนสูงสุดของผู้ที่จะผ่าน ใช้เมื่อ passing_policy=QUOTA",
            value_type: "NUMBER",
            scope: "CAMPAIGN",
            default_value: null,
            required: false,
        },
        {
            setting_key: "minimum_passing_score",
            name: "คะแนนขั้นต่ำ",
            description: "คะแนนรวมขั้นต่ำสำหรับผ่าน",
            value_type: "NUMBER",
            scope: "CAMPAIGN",
            default_value: 0,
            required: false,
        },
        {
            setting_key: "passing_policy",
            name: "นโยบายการผ่าน",
            description: "QUOTA | MINIMUM_SCORE | BOTH",
            value_type: "STRING",
            scope: "CAMPAIGN",
            default_value: "MINIMUM_SCORE",
            required: false,
        },
        {
            setting_key: "bag_size",
            name: "จำนวนเล่มต่อถุง",
            description: "จำนวนเล่มข้อสอบสูงสุดต่อถุง",
            value_type: "NUMBER",
            scope: "CAMPAIGN",
            default_value: 30,
            required: false,
        },
        {
            setting_key: "payment_rate_per_booklet",
            name: "ค่าตรวจต่อเล่ม (บาท)",
            description: "ค่าตรวจข้อสอบต่อเล่มสำหรับคำนวณค่าตอบแทน",
            value_type: "NUMBER",
            scope: "CAMPAIGN",
            default_value: 30,
            required: false,
        },
    ];

    for (const def of definitions) {
        await prisma.setting_definitions.upsert({
            where: { setting_key: def.setting_key },
            create: {
                setting_key: def.setting_key,
                name: def.name,
                description: def.description,
                value_type: def.value_type,
                scope: def.scope,
                default_value: def.default_value as never,
                required: def.required,
                active: true,
            },
            update: {
                name: def.name,
                description: def.description,
                default_value: def.default_value as never,
            },
        });
    }
    console.log("✓ Setting definitions seeded");
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
    console.log("🌱 Seeding database...");
    try {
        await seedRoles();
        await seedAdminAccount();
        await seedSettingDefinitions();
        console.log("\n✅ Seed completed successfully");
    } catch (err) {
        console.error("❌ Seed failed:", err);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
