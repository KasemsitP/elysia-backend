import { Elysia } from "elysia";
import { authService } from "./auth.service";
import { requireSession } from "../../cores/session";
import {
    loginBodySchema,
    registerBodySchenma,
    revokeQuerySchema,
    unRevokeQuerySchema,
} from "./auth.schema";

const SESSION_TTL_SECONDS = 60 * 60 * 24; // 24 hours

export const authRoutes = new Elysia({ prefix: "/auth" })
    // Public
    .post("/login", async ({ body, cookie, set }) => {
        const { sid, ...result } = await authService.login(body);
        cookie.sid!.set({
            value: sid,
            httpOnly: true,
            sameSite: "strict",
            path: "/",
            maxAge: SESSION_TTL_SECONDS,
        });
        set.status = 200;
        return result;
    }, {
        body: loginBodySchema,
    })
    // Protected
    .use(requireSession)
    .post("/logout", async ({ cookie, set }) => {
        const sid = cookie.sid?.value as string | undefined;
        if (sid) await authService.logout(sid);
        cookie.sid!.remove();
        set.status = 200;
        return { message: "ออกจากระบบสำเร็จ" };
    })
    .get("/me", async ({ session, set }) => {
        const result = await authService.me(session.account_id);
        set.status = 200;
        return result;
    })
    .post("/register", async ({ body, set }) => {
        const result = await authService.register(body);
        set.status = 201;
        return result;
    }, {
        body: registerBodySchenma,
    })
    .put("/revoke/:id", async ({ params, set }) => {
        const result = await authService.revokeAccount(params);
        set.status = 200;
        return result;
    }, {
        params: revokeQuerySchema,
    })
    .put("/un-revoke/:id", async ({ params, set }) => {
        const result = await authService.unRevokeAccount(params);
        set.status = 200;
        return result;
    }, {
        params: unRevokeQuerySchema,
    });
