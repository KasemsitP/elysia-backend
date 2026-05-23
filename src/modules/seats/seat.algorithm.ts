import type { SeatUser, SeatLayoutItem, SeatPos } from "./seat.type";

const MAX_PASSES = 10;

/** ตรวจ conflict นามสกุลที่ตำแหน่ง (r, c) กับ 4 ทิศ */
export function hasConflict(rows: (SeatUser | null)[][], r: number, c: number): boolean {
    const user = rows[r]?.[c];
    if (!user?.lastName) return false;
    const ln = user.lastName;
    const neighbors: [number, number][] = [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]];
    for (const [nr, nc] of neighbors) {
        const n = rows[nr]?.[nc];
        if (n?.lastName && n.lastName === ln) return true;
    }
    return false;
}

/** คืน array ตำแหน่งที่มี conflict ทั้งหมด */
export function findConflicts(rows: (SeatUser | null)[][]): SeatPos[] {
    const out: SeatPos[] = [];
    for (let r = 0; r < rows.length; r++) {
        const row = rows[r]!;
        for (let c = 0; c < row.length; c++) {
            if (row[c] && hasConflict(rows, r, c)) out.push({ r, c });
        }
    }
    return out;
}

/**
 * จัดที่นั่ง: greedy placement → swap pass ลด conflict
 *
 * "แถว" = column แนวตั้ง — วางจากบนลงล่าง แล้วขยับไปแถว (column) ถัดไป
 *
 * seatsPerRow = จำนวนคนต่อแถว (ความสูงของแต่ละ column)
 * Grid: rows[rowIndex][colIndex]
 *   - rowIndex  = ตำแหน่งในแถว (0 = บนสุด)
 *   - colIndex  = ลำดับแถว (0 = แถวซ้ายสุด)
 *
 * ลำดับการวาง: colIndex=0 จากบนลงล่าง → colIndex=1 → ...
 *
 * Swap pass: สลับภายใน column เดียวกัน
 */
export function arrangeSeatForUsers(
    users: SeatUser[],
    seatsPerRow: number,
): { rows: (SeatUser | null)[][]; conflictCount: number } {
    if (users.length === 0) return { rows: [], conflictCount: 0 };

    const numRows = seatsPerRow;                           // ความสูง = seats per column
    const numCols = Math.ceil(users.length / seatsPerRow); // จำนวนแถว (columns)

    const rows: (SeatUser | null)[][] = Array.from({ length: numRows }, () =>
        Array<SeatUser | null>(numCols).fill(null),
    );

    const pool = [...users];

    // วางจาก column ซ้ายไปขวา แต่ละ column วางจากบนลงล่าง
    for (let c = 0; c < numCols; c++) {
        for (let r = 0; r < numRows && pool.length > 0; r++) {
            const left  = rows[r]?.[c - 1] ?? null; // ซ้าย = แถวก่อนหน้า ระดับเดียวกัน
            const above = rows[r - 1]?.[c] ?? null; // บน = คนก่อนหน้าในแถวเดียวกัน
            const safeIdx = pool.findIndex(
                (u) =>
                    (!left?.lastName  || left.lastName  !== u.lastName) &&
                    (!above?.lastName || above.lastName !== u.lastName),
            );
            rows[r]![c] = safeIdx >= 0 ? pool.splice(safeIdx, 1)[0]! : pool.shift()!;
        }
    }

    // Swap pass — สลับภายใน column เดียวกัน
    for (let pass = 0; pass < MAX_PASSES; pass++) {
        const conflicts = findConflicts(rows);
        if (conflicts.length === 0) break;

        let improved = false;
        outer: for (const { r, c } of conflicts) {
            for (let r2 = 0; r2 < numRows; r2++) {
                if (r2 === r) continue;
                const before =
                    (hasConflict(rows, r,  c) ? 1 : 0) +
                    (hasConflict(rows, r2, c) ? 1 : 0);
                [rows[r]![c], rows[r2]![c]] = [rows[r2]![c]!, rows[r]![c]!];
                const after =
                    (hasConflict(rows, r,  c) ? 1 : 0) +
                    (hasConflict(rows, r2, c) ? 1 : 0);
                if (after < before) { improved = true; break outer; }
                // revert ถ้าไม่ดีขึ้น
                [rows[r]![c], rows[r2]![c]] = [rows[r2]![c]!, rows[r]![c]!];
            }
        }
        if (!improved) break;
    }

    return { rows, conflictCount: findConflicts(rows).length };
}

/** แปลง rows grid → SeatLayoutItem[] พร้อม hasConflict */
export function rowsToLayout(rows: (SeatUser | null)[][]): SeatLayoutItem[] {
    const items: SeatLayoutItem[] = [];
    for (let r = 0; r < rows.length; r++) {
        const row = rows[r]!;
        for (let c = 0; c < row.length; c++) {
            const user = row[c];
            if (!user) continue;
            items.push({
                rowIndex: r, colIndex: c,
                rowNo: r + 1, colNo: c + 1,
                userCampaignId: user.userCampaignId,
                userId:         user.userId,
                userCode:       user.userCode,
                title:          user.title,
                fullName:       user.fullName,
                firstName:      user.firstName,
                lastName:       user.lastName,
                hasConflict:    hasConflict(rows, r, c),
            });
        }
    }
    return items;
}

/**
 * สร้าง grid จาก DB rows ที่มี row_no/col_no
 * ใช้สำหรับ GET layout เพื่อคำนวณ hasConflict จากข้อมูลที่บันทึกแล้ว
 */
export function buildGridFromSeated(
    rows: Array<{
        id: number;
        row_no: number | null;
        col_no: number | null;
        users: {
            id: number;
            user_code: string;
            title: string | null;
            full_name: string;
            first_name: string | null;
            last_name: string | null;
        } | null;
    }>,
): { layout: SeatLayoutItem[]; seatsPerRow: number } {
    if (rows.length === 0) return { layout: [], seatsPerRow: 0 };

    const maxRow = Math.max(...rows.map((r) => r.row_no ?? 0));
    const maxCol = Math.max(...rows.map((r) => r.col_no ?? 0));
    if (maxRow === 0 || maxCol === 0) return { layout: [], seatsPerRow: 0 };

    const grid: (SeatUser | null)[][] = Array.from({ length: maxRow }, () =>
        Array<SeatUser | null>(maxCol).fill(null),
    );

    for (const row of rows) {
        if (!row.row_no || !row.col_no || !row.users) continue;
        grid[row.row_no - 1]![row.col_no - 1] = {
            userCampaignId: row.id,
            userId:         row.users.id,
            userCode:       row.users.user_code,
            title:          row.users.title,
            fullName:       row.users.full_name,
            firstName:      row.users.first_name,
            lastName:       row.users.last_name,
        };
    }

    return { layout: rowsToLayout(grid), seatsPerRow: maxCol };
}
