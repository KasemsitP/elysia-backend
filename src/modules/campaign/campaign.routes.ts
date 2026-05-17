import { Elysia } from "elysia";
import { campaignService } from "./campaign.service";
import { requireSession } from "../../cores/session";
import {
    campaignIdParamSchema,
    createCampaignBodySchema,
    updateCampaignBodySchema,
    setActiveBodySchema,
    setQrActiveBodySchema,
} from "./campaign.schema";

export const campaignRoutes = new Elysia({ prefix: "/campaigns" })
    .use(requireSession)
    .get("/", async ({ set }) => {
        set.status = 200;
        return campaignService.findAll();
    })
    .get("/:campaignId", async ({ params, set }) => {
        set.status = 200;
        return campaignService.findById(params.campaignId);
    }, { params: campaignIdParamSchema })
    .get("/:campaignId/full", async ({ params, set }) => {
        set.status = 200;
        return campaignService.findByIdFull(params.campaignId);
    }, { params: campaignIdParamSchema })
    .post("/", async ({ body, set }) => {
        set.status = 201;
        return campaignService.create(body);
    }, { body: createCampaignBodySchema })
    .patch("/:campaignId", async ({ params, body, set }) => {
        set.status = 200;
        return campaignService.update(params.campaignId, body);
    }, { params: campaignIdParamSchema, body: updateCampaignBodySchema })
    .patch("/:campaignId/active", async ({ params, body, set }) => {
        set.status = 200;
        return campaignService.setActive(params.campaignId, body);
    }, { params: campaignIdParamSchema, body: setActiveBodySchema })
    .patch("/:campaignId/qr-active", async ({ params, body, set }) => {
        set.status = 200;
        return campaignService.setQrActive(params.campaignId, body);
    }, { params: campaignIdParamSchema, body: setQrActiveBodySchema })
    .delete("/:campaignId", async ({ params, set }) => {
        set.status = 200;
        return campaignService.delete(params.campaignId);
    }, { params: campaignIdParamSchema });
