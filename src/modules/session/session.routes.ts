
import { Param } from "@prisma/client/runtime/client";
import { sessionService } from "./session.service";
import { sessionQuerySchema, sessionCreateBodySchema, campaignQuerySchema } from "./sessions.schema";
import { Elysia } from "elysia";

export const sessionRoutes = new Elysia({ prefix: "/session" })
    .get("/", async ({ set }) => {
        const result = await sessionService.findAllSession();
        set.status = 200;
        return result;
    })
    .get("/:session_id", async ({ params, set }) => {
        const result = await sessionService.findSessionById(Number(params.session_id));
        set.status = 200;
        return result
    }, {
        params: sessionQuerySchema
    })
    .get("/campaign/:campaign_id", async ({ params, set }) => {
        const result = await sessionService.findSessionByCampaign(Number(params.campaign_id));
        set.status = 200;
        return result;
    }, {
        params: campaignQuerySchema
    })
    .post("/", async ({ params, body, set }) => {
        const result = await sessionService.createSession(body);
        set.status = 201;
        return result;
    }, {
        body: sessionCreateBodySchema
    })
