/**
 * Unit tests: Seat arrangement algorithm
 *
 * Tests all exported pure functions from src/modules/seats/seat.algorithm.ts:
 *   hasConflict, findConflicts, arrangeSeatForUsers, rowsToLayout, buildGridFromSeated
 *
 * Run: bun test tests/unit/seat-algorithm.test.ts
 */
import { describe, it, expect } from "bun:test";
import {
    hasConflict,
    findConflicts,
    arrangeSeatForUsers,
    rowsToLayout,
    buildGridFromSeated,
} from "../../src/modules/seats/seat.algorithm";
import type { SeatUser } from "../../src/modules/seats/seat.type";

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeUser(
    id: number,
    lastName: string | null,
    firstName = "ชื่อ",
): SeatUser {
    return {
        userCampaignId: id,
        userId: id,
        userCode: `U${id}`,
        title: "นาย",
        fullName: `${firstName} ${lastName ?? ""}`.trim(),
        firstName,
        lastName,
    };
}

/** Build a simple grid from a 2D array of SeatUser | null */
function grid(rows: (SeatUser | null)[][]): (SeatUser | null)[][] {
    return rows;
}

// ── hasConflict ────────────────────────────────────────────────────────────────

describe("hasConflict: ตรวจ conflict นามสกุลที่ตำแหน่ง (r, c)", () => {
    it("ไม่มีเพื่อนบ้าน → false", () => {
        const g = grid([[makeUser(1, "สมิธ")]]);
        expect(hasConflict(g, 0, 0)).toBe(false);
    });

    it("เพื่อนบ้านนามสกุลต่างกัน → false", () => {
        const g = grid([
            [makeUser(1, "สมิธ"), makeUser(2, "จันทร์")],
        ]);
        expect(hasConflict(g, 0, 0)).toBe(false);
    });

    it("เพื่อนบ้านซ้ายนามสกุลเดียวกัน → true", () => {
        const g = grid([
            [makeUser(1, "สมิธ"), makeUser(2, "สมิธ")],
        ]);
        expect(hasConflict(g, 0, 1)).toBe(true);
    });

    it("เพื่อนบ้านบนนามสกุลเดียวกัน → true", () => {
        const g = grid([
            [makeUser(1, "สมิธ")],
            [makeUser(2, "สมิธ")],
        ]);
        expect(hasConflict(g, 1, 0)).toBe(true);
    });

    it("เพื่อนบ้านล่างนามสกุลเดียวกัน → true", () => {
        const g = grid([
            [makeUser(1, "สมิธ")],
            [makeUser(2, "สมิธ")],
        ]);
        expect(hasConflict(g, 0, 0)).toBe(true);
    });

    it("เพื่อนบ้านขวานามสกุลเดียวกัน → true", () => {
        const g = grid([
            [makeUser(1, "สมิธ"), makeUser(2, "สมิธ")],
        ]);
        expect(hasConflict(g, 0, 0)).toBe(true);
    });

    it("เพื่อนบ้านทแยงมุม (ไม่ใช่ 4 ทิศ) → false", () => {
        const g = grid([
            [makeUser(1, "สมิธ"), makeUser(2, "จันทร์")],
            [makeUser(3, "มั่น"),  makeUser(4, "สมิธ")],
        ]);
        // (0,0) "สมิธ" เพื่อนบ้าน 4 ทิศคือ (0,1)="จันทร์", (1,0)="มั่น" — ทแยงมุม (1,1) ไม่นับ
        expect(hasConflict(g, 0, 0)).toBe(false);
    });

    it("ช่องว่าง (null) → false", () => {
        const g = grid([
            [null, makeUser(1, "สมิธ")],
        ]);
        expect(hasConflict(g, 0, 0)).toBe(false);
    });

    it("user ที่ไม่มี lastName → false (ถือว่าไม่ conflict)", () => {
        const g = grid([
            [makeUser(1, null), makeUser(2, null)],
        ]);
        expect(hasConflict(g, 0, 0)).toBe(false);
    });
});

// ── findConflicts ──────────────────────────────────────────────────────────────

describe("findConflicts: คืน array ตำแหน่งที่มี conflict ทั้งหมด", () => {
    it("grid ว่าง → ไม่มี conflict", () => {
        expect(findConflicts([])).toEqual([]);
    });

    it("นามสกุลทั้งหมดต่างกัน → ไม่มี conflict", () => {
        const g = grid([
            [makeUser(1, "ก"), makeUser(2, "ข")],
            [makeUser(3, "ค"), makeUser(4, "ง")],
        ]);
        expect(findConflicts(g)).toEqual([]);
    });

    it("นามสกุลเดียวกัน 2 ตำแหน่ง adjacent → มี conflict 2 จุด", () => {
        const g = grid([
            [makeUser(1, "สมิธ"), makeUser(2, "สมิธ")],
        ]);
        const conflicts = findConflicts(g);
        expect(conflicts.length).toBe(2); // ทั้งสองตำแหน่ง conflict กันเอง
    });

    it("นับเฉพาะที่มี user (ไม่นับ null)", () => {
        const g = grid([
            [null, makeUser(1, "สมิธ"), makeUser(2, "สมิธ")],
        ]);
        const conflicts = findConflicts(g);
        // (0,1) และ (0,2) ต่างก็ conflict กัน
        expect(conflicts.length).toBe(2);
    });
});

// ── arrangeSeatForUsers ────────────────────────────────────────────────────────

describe("arrangeSeatForUsers: จัดที่นั่ง greedy + swap pass", () => {
    it("ไม่มีผู้สมัคร → rows ว่าง", () => {
        const result = arrangeSeatForUsers([], 5);
        expect(result.rows).toEqual([]);
        expect(result.conflictCount).toBe(0);
    });

    it("1 คน → 1 ช่อง ไม่มี conflict", () => {
        const users = [makeUser(1, "สมิธ")];
        const { rows, conflictCount } = arrangeSeatForUsers(users, 5);
        expect(conflictCount).toBe(0);
        const placed = rows.flat().filter(Boolean);
        expect(placed.length).toBe(1);
    });

    it("วางครบทุกคน (ไม่หาย)", () => {
        const users = Array.from({ length: 10 }, (_, i) => makeUser(i + 1, `นามสกุล${i}`));
        const { rows } = arrangeSeatForUsers(users, 4);
        const placed = rows.flat().filter(Boolean);
        expect(placed.length).toBe(10);
    });

    it("นามสกุลทั้งหมดต่างกัน → conflictCount = 0", () => {
        const users = Array.from({ length: 6 }, (_, i) => makeUser(i + 1, `นาม${i}`));
        const { conflictCount } = arrangeSeatForUsers(users, 3);
        expect(conflictCount).toBe(0);
    });

    it("นามสกุลเดียวกันทุกคน → algorithm พยายาม minimize conflict", () => {
        // ถ้าทุกคนนามสกุลเดียวกัน conflict เป็น inevitable แต่ต้องวางครบ
        const users = Array.from({ length: 4 }, (_, i) => makeUser(i + 1, "สมิธ"));
        const { rows } = arrangeSeatForUsers(users, 2);
        const placed = rows.flat().filter(Boolean);
        expect(placed.length).toBe(4);
    });

    it("seatsPerRow กำหนดจำนวนแถวถูกต้อง", () => {
        const users = Array.from({ length: 6 }, (_, i) => makeUser(i + 1, `นาม${i}`));
        const { rows } = arrangeSeatForUsers(users, 3);
        // numRows = seatsPerRow = 3, numCols = ceil(6/3) = 2
        expect(rows.length).toBe(3);
        expect(rows[0]!.length).toBe(2);
    });
});

// ── rowsToLayout ───────────────────────────────────────────────────────────────

describe("rowsToLayout: แปลง grid → SeatLayoutItem[]", () => {
    it("grid ว่าง → ไม่มี items", () => {
        expect(rowsToLayout([])).toEqual([]);
    });

    it("แปลงตำแหน่งถูกต้อง (rowNo/colNo = 1-based)", () => {
        const g = grid([
            [makeUser(1, "ก"), null],
            [null,              makeUser(2, "ข")],
        ]);
        const layout = rowsToLayout(g);
        expect(layout.length).toBe(2);

        const first = layout.find((l) => l.userId === 1)!;
        expect(first.rowNo).toBe(1);
        expect(first.colNo).toBe(1);
        expect(first.rowIndex).toBe(0);
        expect(first.colIndex).toBe(0);

        const second = layout.find((l) => l.userId === 2)!;
        expect(second.rowNo).toBe(2);
        expect(second.colNo).toBe(2);
    });

    it("hasConflict ถูกต้องใน layout item", () => {
        const g = grid([
            [makeUser(1, "สมิธ"), makeUser(2, "สมิธ")],
        ]);
        const layout = rowsToLayout(g);
        expect(layout.every((l) => l.hasConflict)).toBe(true);
    });

    it("ไม่รวม null cells", () => {
        const g = grid([[null, makeUser(1, "ก"), null]]);
        const layout = rowsToLayout(g);
        expect(layout.length).toBe(1);
    });

    it("userCode, fullName, title ถูกคัดลอกมาถูกต้อง", () => {
        const user = makeUser(5, "สมบัติ", "ประเสริฐ");
        const g = grid([[user]]);
        const [item] = rowsToLayout(g);
        expect(item!.userCode).toBe("U5");
        expect(item!.lastName).toBe("สมบัติ");
        expect(item!.firstName).toBe("ประเสริฐ");
    });
});

// ── buildGridFromSeated ────────────────────────────────────────────────────────

describe("buildGridFromSeated: สร้าง grid จาก DB rows", () => {
    function makeDbRow(id: number, rowNo: number, colNo: number, lastName: string) {
        return {
            id,
            row_no: rowNo,
            col_no: colNo,
            users: {
                id,
                user_code: `U${id}`,
                title: "นาย" as string | null,
                full_name: `ชื่อ ${lastName}`,
                first_name: "ชื่อ",
                last_name: lastName,
            },
        };
    }

    it("rows ว่าง → layout ว่าง, seatsPerRow=0", () => {
        const result = buildGridFromSeated([]);
        expect(result.layout).toEqual([]);
        expect(result.seatsPerRow).toBe(0);
    });

    it("แปลงตำแหน่ง DB rows เป็น layout items ถูกต้อง", () => {
        const rows = [
            makeDbRow(1, 1, 1, "ก"),
            makeDbRow(2, 1, 2, "ข"),
            makeDbRow(3, 2, 1, "ค"),
        ];
        const { layout, seatsPerRow } = buildGridFromSeated(rows);
        expect(layout.length).toBe(3);
        // seatsPerRow = maxCol = 2
        expect(seatsPerRow).toBe(2);
    });

    it("คำนวณ hasConflict จาก DB data ถูกต้อง", () => {
        // 2 คน adjacent กัน นามสกุลเดียวกัน → conflict
        const rows = [
            makeDbRow(1, 1, 1, "สมิธ"),
            makeDbRow(2, 1, 2, "สมิธ"),
        ];
        const { layout } = buildGridFromSeated(rows);
        expect(layout.every((l) => l.hasConflict)).toBe(true);
    });

    it("row_no หรือ col_no เป็น null → ข้าม", () => {
        const rows = [
            { id: 1, row_no: null, col_no: 1, users: { id: 1, user_code: "U1", title: null, full_name: "A", first_name: null, last_name: null } },
            makeDbRow(2, 1, 1, "ก"),
        ] as Parameters<typeof buildGridFromSeated>[0];
        const { layout } = buildGridFromSeated(rows);
        expect(layout.length).toBe(1);
    });

    it("row_no=0 หรือ col_no=0 → layout ว่าง", () => {
        const rows = [
            { id: 1, row_no: 0, col_no: 0, users: { id: 1, user_code: "U1", title: null, full_name: "A", first_name: null, last_name: null } },
        ] as Parameters<typeof buildGridFromSeated>[0];
        const { layout, seatsPerRow } = buildGridFromSeated(rows);
        expect(layout).toEqual([]);
        expect(seatsPerRow).toBe(0);
    });
});

// ── Integration: arrangeSeatForUsers → rowsToLayout ───────────────────────────

describe("Integration: arrange → layout", () => {
    it("layout.length = จำนวน users ที่วาง", () => {
        const users = Array.from({ length: 8 }, (_, i) => makeUser(i + 1, `นาม${i}`));
        const { rows } = arrangeSeatForUsers(users, 4);
        const layout = rowsToLayout(rows);
        expect(layout.length).toBe(8);
    });

    it("rowNo และ colNo ใน layout ไม่ต่ำกว่า 1", () => {
        const users = Array.from({ length: 6 }, (_, i) => makeUser(i + 1, `นาม${i}`));
        const { rows } = arrangeSeatForUsers(users, 3);
        const layout = rowsToLayout(rows);
        for (const item of layout) {
            expect(item.rowNo).toBeGreaterThanOrEqual(1);
            expect(item.colNo).toBeGreaterThanOrEqual(1);
        }
    });
});
