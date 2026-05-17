import { Elysia } from "elysia";
import { prisma } from "./prisma";
import { AppError } from "./errors";
import type { SessionData } from "../modules/auth/auth.type";

export const sessionPlugin = new Elysia({ name: "session" })
    .derive({ as: "scoped" }, async ({ cookie }) => {
        const sid = cookie.sid?.value as string | undefined;
        if (!sid) return { session: null as SessionData | null };

        const now = Math.floor(Date.now() / 1000);
        const row = await prisma.auth_sessions.findUnique({ where: { sid } });
        if (!row || row.expires < now) return { session: null as SessionData | null };

        return { session: JSON.parse(row.data) as SessionData };
    });

export const requireSession = new Elysia({ name: "require-session" })
    .use(sessionPlugin)
    .derive({ as: "scoped" }, ({ session }) => {
        if (!session) throw new AppError("กรุณาเข้าสู่ระบบ", 401);
        return { session };
    });
