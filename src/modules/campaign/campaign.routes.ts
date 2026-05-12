
import { campaignService } from "./campaign.service";
import { campaignQuerySchema, updateBodySchema, createBodySchema } from "./campaign.schema";
import { Elysia } from "elysia";




export const campaignRoutes = new Elysia({ prefix: "/campaign" })
    .get("/", async ({ set }) => {
        const result = await campaignService.findAllCampaignWithSessionsAndSubjects();
        set.status = 200;
        return result;
    })
    .get("/:campaign_id", async ({ params, set }) => {
        const result = await campaignService.findCampaignWithSessionsAndSubjects(params.campaign_id);
        set.status = 200;
        return result;
    }, {
        params: campaignQuerySchema
    })
    .put("/:campaign_id/active", async ({ params, set }) => {
        //console.log(params.campaign_id);
        const result = await campaignService.updateCampaignIsActive(params.campaign_id, true);
        set.status = 200;
        return result;
    }, {
        params: campaignQuerySchema
    })
    .put("/:campaign_id/inactive", async ({ params, set }) => {
        //console.log(params.campaign_id);
        const result = await campaignService.updateCampaignIsActive(params.campaign_id, false);
        set.status = 200;
        return result;
    }, {
        params: campaignQuerySchema
    })
    .put("/:campaign_id", async ({ params, body, set }) => {
        const result = await campaignService.updateCampaign(params.campaign_id, body);
        set.status = 200;
        return result;
    }, {
        params: campaignQuerySchema,
        body: updateBodySchema
    })
    .post("/", async ({ body, set }) => {
        const result = await campaignService.createCampaign(body);
        set.status = 201;
        return result;
    }, {
        body: createBodySchema
    })
    .get("/:campaign_id/qr-active", async ({ params, set }) => {
        const result = await campaignService.findQrActive(params.campaign_id);
        set.status = 200;
        return result;
    }, {
        params: campaignQuerySchema
    })
    .put("/:campaign_id/qr-active", async ({ params, body, set }) => {
        const result = await campaignService.updateQrActive(params.campaign_id);
        set.status = 200;
        return result;
    }, {
        params: campaignQuerySchema,
    })