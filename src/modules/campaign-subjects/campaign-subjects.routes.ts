import { Elysia } from "elysia";
import { campaignSubjectService } from "./campaign-subjects.service";
import { requireSession } from "../../cores/session";
import {
    campaignSubjectParentParamSchema,
    campaignSubjectParamSchema,
    createCampaignSubjectBodySchema,
    updateCampaignSubjectBodySchema,
} from "./campaign-subjects.schema";

export const campaignSubjectRoutes = new Elysia({ prefix: "/campaigns/:campaignId/subjects" })
    .use(requireSession)
    .get("/", async ({ params, set }) => {
        set.status = 200;
        return campaignSubjectService.findByCampaign(params.campaignId);
    }, { params: campaignSubjectParentParamSchema })
    .post("/", async ({ params, body, set }) => {
        set.status = 201;
        return campaignSubjectService.create(params.campaignId, body);
    }, { params: campaignSubjectParentParamSchema, body: createCampaignSubjectBodySchema })
    .patch("/:campaignSubjectId", async ({ params, body, set }) => {
        set.status = 200;
        return campaignSubjectService.update(params.campaignId, params.campaignSubjectId, body);
    }, { params: campaignSubjectParamSchema, body: updateCampaignSubjectBodySchema })
    .delete("/:campaignSubjectId", async ({ params, set }) => {
        set.status = 200;
        return campaignSubjectService.delete(params.campaignId, params.campaignSubjectId);
    }, { params: campaignSubjectParamSchema });
