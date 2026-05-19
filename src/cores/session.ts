import { Elysia } from "elysia";
import { prisma } from "./prisma";
import { AppError } from "./errors";
import type { SessionData } from "../modules/auth/auth.type";

async function loadSession(sid: string | undefined): Promise<SessionData | null> {
    if (!sid) return null;

    const now = Math.floor(Date.now() / 1000);
    const row = await prisma.auth_sessions.findUnique({
        where: { sid },
        include: {
            accounts: {
                select: {
                    active: true,
                    deleted_at: true,
                },
            },
        },
    });

    if (!row || row.expires < now) return null;

    if (!row.accounts || !row.accounts.active || row.accounts.deleted_at !== null) {
        await prisma.auth_sessions.delete({ where: { sid } }).catch(() => null);
        return null;
    }

    return JSON.parse(row.data) as SessionData;
}

export const sessionPlugin = new Elysia({ name: "session" })
    .derive({ as: "scoped" }, async ({ cookie }) => {
        const sid = cookie.sid?.value as string | undefined;
        const session = await loadSession(sid);
        return { session };
    });

export const requireSession = new Elysia({ name: "require-session" })
    .derive({ as: "scoped" }, async ({ cookie }) => {
        const sid = cookie.sid?.value as string | undefined;
        const session = await loadSession(sid);
        if (!session) throw new AppError("กรุณาเข้าสู่ระบบ", 401);
        return { session };
    });
