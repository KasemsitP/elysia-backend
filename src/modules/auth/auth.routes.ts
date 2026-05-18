import { Elysia } from "elysia";
import { authService } from "./auth.service";
import { requireSession } from "../../cores/session";
import { requireAdmin } from "../../cores/auth-guard";
import { loginRateLimit } from "../../cores/rate-limit";
import {
    loginBodySchema,
    registerBodySchenma,
    revokeQuerySchema,
    unRevokeQuerySchema,
} from "./auth.schema";

const SESSION_TTL_SECONDS = 60 * 60 * 24;

export const authRoutes = new Elysia({ prefix: "/auth" })
    // ── Public (rate-limited) ─────────────────────────────────────────────────
    .use(loginRateLimit)
    .post("/login", async ({ body, cookie, set }) => {
        const { sid, ...result } = await authService.login(body);
        cookie.sid!.set({ value: sid, httpOnly: true, sameSite: "strict", path: "/", maxAge: SESSION_TTL_SECONDS });
        set.status = 200;
        return result;
    }, { body: loginBodySchema })
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
