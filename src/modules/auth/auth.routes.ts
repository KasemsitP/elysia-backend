import { Elysia } from "elysia";
import { prisma } from "../../cores/prisma";
import { authService } from "./auth.service";
import { requireSession } from "../../cores/session";
import { requireAdmin } from "../../cores/auth-guard";
import { loginRateLimitHandler } from "../../cores/rate-limit";
import {
    loginBodySchema,
    registerBodySchenma,
    revokeQuerySchema,
    unRevokeQuerySchema,
} from "./auth.schema";

const SESSION_TTL_SECONDS = 60 * 60 * 24;
const isProd = process.env.NODE_ENV === "production";

export const authRoutes = new Elysia({ prefix: "/auth" })
    // ── Public (rate-limited) ─────────────────────────────────────────────────
    .post("/login", async ({ body, cookie, set }) => {
        const { sid, ...result } = await authService.login(body);
        cookie.sid!.set({
            value: sid,
            httpOnly: true,
            secure: isProd,
            sameSite: isProd ? "none" : "lax",
            path: "/",
            maxAge: SESSION_TTL_SECONDS,
        });
        set.status = 200;
        return result;
    }, { body: loginBodySchema, beforeHandle: loginRateLimitHandler })
    // ── Authenticated ─────────────────────────────────────────────────────────
    .use(requireSession)
    .post("/logout", async ({ cookie, set }) => {
        const sid = cookie.sid?.value as string | undefined;
        if (sid) await authService.logout(sid);
        cookie.sid!.remove();
        set.status = 200;
        return { message: "ออกจากระบบสำเร็จ" };
    })
    .get("/me", ({ session, set }) => {
        set.status = 200;
        return authService.me(session.account_id);
    })
    // ── ADMIN only ────────────────────────────────────────────────────────────
    .use(requireAdmin())
    // รายชื่อ accounts ทั้งหมด (ไม่แสดง password/hash)
    .get("/accounts", async ({ set }) => {
        const accounts = await prisma.accounts.findMany({
            where: { deleted_at: null },
            select: {
                id: true,
                username: true,
                full_name: true,
                email: true,
                role_id: true,
                active: true,
                manager_order: true,
                campaign_id: true,
                created_at: true,
                title: true,
            },
            orderBy: [{ role_id: "asc" }, { id: "asc" }],
        });
        set.status = 200;
        return { success: true, message: "ดึงรายชื่อบัญชีสำเร็จ", data: accounts };
    })
    .post("/register", ({ body, set }) => {
        set.status = 201;
        return authService.register(body);
    }, { body: registerBodySchenma })
    .put("/revoke/:id", ({ params, set }) => {
        set.status = 200;
        return authService.revokeAccount(params);
    }, { params: revokeQuerySchema })
    .put("/un-revoke/:id", ({ params, set }) => {
        set.status = 200;
        return authService.unRevokeAccount(params);
    }, { params: unRevokeQuerySchema });
