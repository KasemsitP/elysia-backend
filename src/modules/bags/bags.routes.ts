import { Elysia } from "elysia";
import { bagService } from "./bags.service";
import { requireSession } from "../../cores/session";
import { requireAdminOrStaff } from "../../cores/auth-guard";
import { scanRateLimit } from "../../cores/rate-limit";
import {
    bagCampaignParamSchema,
    bagCampaignSessionParamSchema,
    bagIdParamSchema,
    scanPreviewBodySchema,
    createBagBodySchema,
    updateBagStatusBodySchema,
} from "./bags.schema";

// Read → any authenticated
const readRoutes = new Elysia()
    .use(requireSession)
    .get("/campaigns/:campaignId/bags", ({ params, set }) => { set.status = 200; return bagService.findByCampaign(params.campaignId); }, { params: bagCampaignParamSchema })
    .get("/campaigns/:campaignId/sessions/:sessionId/bags", ({ params, set }) => { set.status = 200; return bagService.findByCampaignAndSession(params.campaignId, params.sessionId); }, { params: bagCampaignSessionParamSchema })
    .get("/bags/:bagId",          ({ params, set }) => { set.status = 200; return bagService.findById(params.bagId); },        { params: bagIdParamSchema })
    .get("/bags/:bagId/booklets", ({ params, set }) => { set.status = 200; return bagService.findBooklets(params.bagId); },    { params: bagIdParamSchema })
    .get("/bags/:bagId/summary",  ({ params, set }) => { set.status = 200; return bagService.findSummary(params.bagId); },     { params: bagIdParamSchema });

// Write → ADMIN or STAFF (+ rate limit on scan)
const writeRoutes = new Elysia()
    .use(requireAdminOrStaff())
    .use(scanRateLimit)
    .post("/bags/scan/preview", ({ body, set }) => { set.status = 200; return bagService.scanPreview(body); }, { body: scanPreviewBodySchema })
    .post("/bags",              ({ body, session, set }) => { set.status = 201; return bagService.create(body, session); }, { body: createBagBodySchema })
    .patch("/bags/:bagId/status", ({ params, body, set }) => { set.status = 200; return bagService.updateStatus(params.bagId, body); }, { params: bagIdParamSchema, body: updateBagStatusBodySchema })
    .delete("/bags/:bagId",     ({ params, set }) => { set.status = 200; return bagService.delete(params.bagId); }, { params: bagIdParamSchema });

export const bagRoutes = new Elysia().use(readRoutes).use(writeRoutes);
