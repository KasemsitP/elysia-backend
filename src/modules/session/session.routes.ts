import { Elysia } from "elysia";
import { sessionService } from "./session.service";
import { requireSession } from "../../cores/session";
import {
    sessionCampaignParamSchema,
    sessionParamSchema,
    createSessionBodySchema,
    updateSessionBodySchema,
} from "./sessions.schema";

export const sessionRoutes = new Elysia({ prefix: "/campaigns/:campaignId/sessions" })
    .use(requireSession)
    .get("/", async ({ params, set }) => {
        set.status = 200;
        return sessionService.findByCampaign(params.campaignId);
    }, { params: sessionCampaignParamSchema })
    .get("/:sessionId", async ({ params, set }) => {
        set.status = 200;
        return sessionService.findById(params.campaignId, params.sessionId);
    }, { params: sessionParamSchema })
    .post("/", async ({ params, body, set }) => {
        set.status = 201;
        return sessionService.create(params.campaignId, body);
    }, { params: sessionCampaignParamSchema, body: createSessionBodySchema })
    .patch("/:sessionId", async ({ params, body, set }) => {
        set.status = 200;
        return sessionService.update(params.campaignId, params.sessionId, body);
    }, { params: sessionParamSchema, body: updateSessionBodySchema })
    .delete("/:sessionId", async ({ params, set }) => {
        set.status = 200;
        return sessionService.delete(params.campaignId, params.sessionId);
    }, { params: sessionParamSchema });
