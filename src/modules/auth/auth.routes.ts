import { Elysia } from "elysia";
import { authService } from "./auth.service";

import {
    loginBodySchema,
    registerBodySchenma,
    revokeQuerySchema,
    unRevokeQuerySchema,
    meQuerySchema
} from "./auth.schema";


export const authRoutes = new Elysia({ prefix: "/auth" })
    .post("/login", async ({ body, set }) => {
        const result = await authService.login(body);
        set.status = 200;
        return result;
    }, {
        body: loginBodySchema
    })
    .post("/register", async ({ body, set }) => {
        const result = await authService.register(body);
        set.status = 201;
        return result;
    }, {
        body: registerBodySchenma
    })
    .put("/revoke/:id", async ({ params, set }) => {
        const result = await authService.revokeAccount(params);
        set.status = 200;
        return result;
    }, {
        params: revokeQuerySchema
    })
    .put("/un-revoke/:id", async ({ params, set }) => {
        const result = await authService.unRevokeAccount(params);
        set.status = 200;
        return result;
    }, {
        params: unRevokeQuerySchema
    })
    .get("/me/:id", async ({ params, set }) => {
        const result = await authService.me(params);
        set.status = 200;
        return result;
    }, {
        params: meQuerySchema
    })
// .post("/logout", async () => {
//     return authService.logout();
// });