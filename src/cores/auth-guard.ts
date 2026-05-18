import { Elysia } from "elysia";
import { AppError } from "./errors";
import { requireSession } from "./session";

export type Role = "ADMIN" | "STAFF" | "MANAGER" | "GRADER";

const roleMap: Record<number, Role> = {
    1: "ADMIN",
    2: "STAFF",
    3: "MANAGER",
    4: "GRADER",
};

/** Guard พื้นฐาน — ตรวจ role ที่อนุญาต */
export function requireRole(...roles: Role[]) {
    const name = `role:${roles.join(",")}`;
    return new Elysia({ name })
        .use(requireSession)
        .derive({ as: "scoped" }, ({ session }) => {
            if (!session) throw new AppError("กรุณาเข้าสู่ระบบ", 401);
            const role = roleMap[session.role_id];
            if (!role || !roles.includes(role)) {
                throw new AppError(`ต้องมีสิทธิ์ ${roles.join(" หรือ ")}`, 403);
            }
            return { session, role };
        });
}

// ── Convenience guards ─────────────────────────────────────────────────────────

/** ADMIN only */
export const requireAdmin = () => requireRole("ADMIN");

/** ADMIN + MANAGER — สำหรับ campaign setup, unlock, key management */
export const requireAdminOrManager = () => requireRole("ADMIN", "MANAGER");

/** ADMIN + STAFF — สำหรับ operational data (users, rooms, bags) */
export const requireAdminOrStaff = () => requireRole("ADMIN", "STAFF");

/** ADMIN + MANAGER + STAFF — ทุกคนยกเว้น GRADER */
export const requireNonGrader = () => requireRole("ADMIN", "MANAGER", "STAFF");

/** GRADER only */
export const requireGrader = () => requireRole("GRADER");

/** ADMIN + MANAGER + GRADER — สำหรับ grading flow */
export const requireGradingAccess = () => requireRole("ADMIN", "MANAGER", "GRADER");

/**
 * Role matrix สรุป:
 *
 * Route group              | ADMIN | MANAGER | STAFF | GRADER
 * ─────────────────────────┼───────┼─────────┼───────┼───────
 * subjects (write)         |   ✓   |         |       |
 * campaigns (write)        |   ✓   |    ✓    |       |
 * campaign-settings (write)|   ✓   |    ✓    |       |
 * campaign-keys            |   ✓   |    ✓    |       |
 * sessions/subjects/q      |   ✓   |    ✓    |       |
 * users/rooms/candidates   |   ✓   |         |   ✓   |
 * booklets generate        |   ✓   |    ✓    |       |
 * bags (create)            |   ✓   |         |   ✓   |
 * graders/assignments      |   ✓   |    ✓    |       |
 * grading (start/confirm)  |   ✓   |    ✓    |       |   ✓
 * grading (read)           |   ✓   |    ✓    |   ✓   |   ✓
 * reports                  |   ✓   |    ✓    |   ✓   |
 * incidents/notes (write)  |   ✓   |    ✓    |   ✓   |   ✓
 * incidents (resolve)      |   ✓   |    ✓    |       |
 * otp / unlock             |   ✓   |    ✓    |       |
 */
