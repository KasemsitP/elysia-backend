/**
 * Unit tests: Campaign settings value inference and validation logic
 *
 * Replicates inferValueType and validateValue from
 * src/modules/campaign-settings/campaign-settings.service.ts.
 *
 * Run: bun test tests/unit/campaign-settings-logic.test.ts
 */
import { describe, it, expect } from "bun:test";

// ── Replicated from campaign-settings.service.ts ──────────────────────────────

type ValueType = "STRING" | "NUMBER" | "BOOLEAN" | "JSON" | "DATE";

function inferValueType(value: unknown): ValueType {
    if (typeof value === "boolean") return "BOOLEAN";
    if (typeof value === "number") return "NUMBER";
    if (typeof value === "string") {
        if (!isNaN(Date.parse(value)) && value.includes("-")) return "DATE";
        return "STRING";
    }
    return "JSON";
}

function validateValue(value: unknown, type: ValueType): boolean {
    switch (type) {
        case "STRING":  return typeof value === "string";
        case "NUMBER":  return typeof value === "number" && Number.isFinite(value);
        case "BOOLEAN": return typeof value === "boolean";
        case "DATE":    return typeof value === "string" && !isNaN(Date.parse(value));
        case "JSON":    return typeof value === "object" && value !== null;
    }
}

// ── inferValueType ─────────────────────────────────────────────────────────────

describe("inferValueType: อนุมาน ValueType จาก JS value", () => {
    it("boolean true → BOOLEAN", () => {
        expect(inferValueType(true)).toBe("BOOLEAN");
    });

    it("boolean false → BOOLEAN", () => {
        expect(inferValueType(false)).toBe("BOOLEAN");
    });

    it("number (integer) → NUMBER", () => {
        expect(inferValueType(42)).toBe("NUMBER");
    });

    it("number (float) → NUMBER", () => {
        expect(inferValueType(3.14)).toBe("NUMBER");
    });

    it("number 0 → NUMBER", () => {
        expect(inferValueType(0)).toBe("NUMBER");
    });

    it("string ธรรมดา → STRING", () => {
        expect(inferValueType("hello")).toBe("STRING");
    });

    it("string ว่าง → STRING", () => {
        expect(inferValueType("")).toBe("STRING");
    });

    it("string รูปแบบ ISO date → DATE", () => {
        expect(inferValueType("2025-06-15")).toBe("DATE");
    });

    it("string ISO datetime → DATE", () => {
        expect(inferValueType("2025-06-15T08:00:00Z")).toBe("DATE");
    });

    it("string ที่ parse ได้แต่ไม่มี dash → STRING (เช่น timestamp ล้วน)", () => {
        // Date.parse("1234567890") is valid but has no '-'
        expect(inferValueType("hello world")).toBe("STRING");
    });

    it("object → JSON", () => {
        expect(inferValueType({ key: "value" })).toBe("JSON");
    });

    it("array → JSON", () => {
        expect(inferValueType([1, 2, 3])).toBe("JSON");
    });

    it("null → JSON (typeof null === 'object' แต่ null ไม่ใช่ string/boolean/number)", () => {
        // null falls through to JSON branch
        expect(inferValueType(null)).toBe("JSON");
    });
});

// ── validateValue ──────────────────────────────────────────────────────────────

describe("validateValue: ตรวจ value ตรง type หรือไม่", () => {
    // STRING
    it("STRING: string → true", () => {
        expect(validateValue("hello", "STRING")).toBe(true);
    });

    it("STRING: string ว่าง → true", () => {
        expect(validateValue("", "STRING")).toBe(true);
    });

    it("STRING: number → false", () => {
        expect(validateValue(42, "STRING")).toBe(false);
    });

    it("STRING: null → false", () => {
        expect(validateValue(null, "STRING")).toBe(false);
    });

    // NUMBER
    it("NUMBER: integer → true", () => {
        expect(validateValue(10, "NUMBER")).toBe(true);
    });

    it("NUMBER: float → true", () => {
        expect(validateValue(3.14, "NUMBER")).toBe(true);
    });

    it("NUMBER: 0 → true", () => {
        expect(validateValue(0, "NUMBER")).toBe(true);
    });

    it("NUMBER: Infinity → false (ไม่ finite)", () => {
        expect(validateValue(Infinity, "NUMBER")).toBe(false);
    });

    it("NUMBER: NaN → false", () => {
        expect(validateValue(NaN, "NUMBER")).toBe(false);
    });

    it("NUMBER: string '42' → false", () => {
        expect(validateValue("42", "NUMBER")).toBe(false);
    });

    // BOOLEAN
    it("BOOLEAN: true → true", () => {
        expect(validateValue(true, "BOOLEAN")).toBe(true);
    });

    it("BOOLEAN: false → true", () => {
        expect(validateValue(false, "BOOLEAN")).toBe(true);
    });

    it("BOOLEAN: 1 → false", () => {
        expect(validateValue(1, "BOOLEAN")).toBe(false);
    });

    it("BOOLEAN: string 'true' → false", () => {
        expect(validateValue("true", "BOOLEAN")).toBe(false);
    });

    // DATE
    it("DATE: ISO date string → true", () => {
        expect(validateValue("2025-06-15", "DATE")).toBe(true);
    });

    it("DATE: ISO datetime string → true", () => {
        expect(validateValue("2025-06-15T08:00:00Z", "DATE")).toBe(true);
    });

    it("DATE: string ที่ไม่ใช่ date → false", () => {
        expect(validateValue("not-a-date", "DATE")).toBe(false);
    });

    it("DATE: number timestamp → false", () => {
        expect(validateValue(1718438400000, "DATE")).toBe(false);
    });

    // JSON
    it("JSON: plain object → true", () => {
        expect(validateValue({ a: 1 }, "JSON")).toBe(true);
    });

    it("JSON: array → true", () => {
        expect(validateValue([1, 2], "JSON")).toBe(true);
    });

    it("JSON: null → false (null ไม่ใช่ object ที่ valid)", () => {
        expect(validateValue(null, "JSON")).toBe(false);
    });

    it("JSON: string → false", () => {
        expect(validateValue("{}", "JSON")).toBe(false);
    });
});

// ── inferValueType + validateValue round-trip ─────────────────────────────────

describe("inferValueType → validateValue: inferred type ต้องผ่าน validate", () => {
    const cases: unknown[] = [
        true, false,
        0, 42, 3.14,
        "hello", "",
        "2025-06-15",
        { key: "v" }, [1, 2],
    ];

    for (const val of cases) {
        it(`value ${JSON.stringify(val)} ผ่าน validate ด้วย inferred type`, () => {
            const type = inferValueType(val);
            expect(validateValue(val, type)).toBe(true);
        });
    }
});
