import { Elysia } from "elysia";
import { campaignService } from "./campaign.service";
import { requireSession } from "../../cores/session";
import { requireAdminOrManager } from "../../cores/auth-guard";
import {
    campaignIdParamSchema,
    createCampaignBodySchema,
    updateCampaignBodySchema,
    setActiveBodySchema,
    setQrActiveBodySchema,
} from "./campaign.schema";

// Read → any authenticated user
const readRoutes = new Elysia({ prefix: "/campaigns" })
    .use(requireSession)
    .get("/", ({ set }) => { set.status = 200; return campaignService.findAll(); })
    .get("/:campaignId", ({ params, set }) => {
        set.status = 200; return campaignService.findById(params.campaignId);
    }, { params: campaignIdParamSchema })
    .get("/:campaignId/full", ({ params, set }) => {
        set.status = 200; return campaignService.findByIdFull(params.campaignId);
    }, { params: campaignIdParamSchema });

// Write → ADMIN or MANAGER only
const writeRoutes = new Elysia({ prefix: "/campaigns" })
    .use(requireSession)
    .use(requireAdminOrManager())
    .post("/", ({ body, set }) => { set.status = 201; return campaignService.create(body); }, { body: createCampaignBodySchema })
    .patch("/:campaignId", ({ params, body, set }) => {
        set.status = 200; return campaignService.update(params.campaignId, body);
    }, { params: campaignIdParamSchema, body: updateCampaignBodySchema })
    .patch("/:campaignId/active", ({ params, body, set }) => {
        set.status = 200; return campaignService.setActive(params.campaignId, body);
    }, { params: campaignIdParamSchema, body: setActiveBodySchema })
    .patch("/:campaignId/qr-active", ({ params, body, set }) => {
        set.status = 200; return campaignService.setQrActive(params.campaignId, body);
    }, { params: campaignIdParamSchema, body: setQrActiveBodySchema })
    .delete("/:campaignId", ({ params, set }) => {
        set.status = 200; return campaignService.delete(params.campaignId);
    }, { params: campaignIdParamSchema });

export const campaignRoutes = new Elysia().use(readRoutes).use(writeRoutes);
