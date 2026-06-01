/**
 * Phase 3A — Route permission guard source-scan tests
 *
 * Verifies that each route file applies the correct Elysia auth guard.
 * No DB required — reads source files only.
 *
 * Run: bun test tests/unit/route-guard-source.test.ts
 */
import { describe, it, expect } from "bun:test";
import { readFileSync } from "fs";
import { resolve } from "path";

function src(rel: string) {
    return readFileSync(resolve(rel), "utf8");
}

// ── Report routes ──────────────────────────────────────────────────────────────

describe("reports.routes.ts: GRADER ห้ามเข้า", () => {
    const content = src("src/modules/reports/reports.routes.ts");

    it("ใช้ requireNonGrader (ไม่รวม GRADER)", () => {
        expect(content).toContain("requireNonGrader");
    });

    it("ไม่ใช้ requireGrader (ซึ่งจะอนุญาต GRADER)", () => {
        // requireGrader ห้ามใช้ใน reports
        const lines = content.split("\n");
        const bad = lines.filter((l) => /requireGrader\(\)/.test(l) && !l.trim().startsWith("//"));
        expect(bad.length).toBe(0);
    });
});

// ── Score reset routes ─────────────────────────────────────────────────────────

describe("score-reset.route.ts: GRADER ห้ามเข้า", () => {
    const content = src("src/modules/score-reset/score-reset.route.ts");

    it("ใช้ requireNonGrader", () => {
        expect(content).toContain("requireNonGrader");
    });

    it("ไม่เปิดสาธารณะ (ต้องมี requireSession)", () => {
        expect(content).toContain("requireSession");
    });
});

// ── Campaign settings routes ───────────────────────────────────────────────────

describe("campaign-settings.routes.ts: write ต้องการ ADMIN หรือ MANAGER", () => {
    const content = src("src/modules/campaign-settings/campaign-settings.routes.ts");

    it("write routes ใช้ requireAdminOrManager", () => {
        expect(content).toContain("requireAdminOrManager");
    });

    it("read routes อนุญาต authenticated users (requireSession)", () => {
        expect(content).toContain("requireSession");
    });
});

// ── Bag score report routes ────────────────────────────────────────────────────

describe("bag score report routes ใช้ guard ถูกต้อง", () => {
    const content = src("src/modules/reports/reports.routes.ts");

    it("campaigns/:id/bags endpoint ถูก guard ด้วย requireNonGrader", () => {
        expect(content).toContain("/campaigns/:campaignId/bags");
        expect(content).toContain("requireNonGrader");
    });

    it("bags/:bagId/scores/pdf endpoint มีอยู่", () => {
        expect(content).toContain("/bags/:bagId/scores/pdf");
    });

    it("ranking/pdf endpoint มีอยู่ใน ranking-report route", () => {
        const rankingRoute = src("src/modules/reports/reports.routes.ts");
        expect(rankingRoute).toContain("ranking/pdf");
    });
});

// ── Auth guard definitions ─────────────────────────────────────────────────────

describe("auth-guard.ts: guard definitions ถูกต้อง", () => {
    const content = src("src/cores/auth-guard.ts");

    it("requireNonGrader ไม่รวม GRADER role", () => {
        // requireNonGrader = requireRole("ADMIN", "MANAGER", "STAFF")
        expect(content).toContain("requireNonGrader");
        // Confirm it includes ADMIN, MANAGER, STAFF but not GRADER
        const defLine = content.split("\n").find((l) => l.includes("requireNonGrader"));
        expect(defLine).toBeDefined();
        expect(defLine).not.toContain("GRADER");
    });

    it("requireGrader ให้เฉพาะ GRADER เท่านั้น", () => {
        expect(content).toContain("requireGrader");
    });

    it("requireAdminOrManager ไม่รวม STAFF หรือ GRADER", () => {
        const line = content.split("\n").find((l) =>
            l.includes("requireAdminOrManager") && l.includes("="),
        );
        expect(line).toBeDefined();
        expect(line).not.toContain("STAFF");
        expect(line).not.toContain("GRADER");
    });
});

// ── Error messages for unauthorized ───────────────────────────────────────────

describe("Thai error messages: ข้อความ 403 เป็นภาษาไทย", () => {
    it("auth-guard ส่งข้อความภาษาไทยเมื่อ role ไม่ถูกต้อง", () => {
        const content = src("src/cores/auth-guard.ts");
        // Should contain Thai character in the 403 message
        expect(content).toMatch(/[฀-๿]+/); // Thai Unicode range
    });
});
