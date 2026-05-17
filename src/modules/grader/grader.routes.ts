import { Elysia } from "elysia";
import { graderService } from "./grader.service";
import { requireSession } from "../../cores/session";
import {
    graderCampaignParamSchema,
    graderIdParamSchema,
    createGraderBodySchema,
    updateGraderBodySchema,
} from "./grader.schema";

export const graderRoutes = new Elysia()
    .use(requireSession)
    .get(
        "/campaigns/:campaignId/graders",
        ({ params, set }) => {
            set.status = 200;
            return graderService.findByCampaign(params.campaignId);
        },
        { params: graderCampaignParamSchema },
    )
    .get(
        "/graders/:graderId",
        ({ params, set }) => {
            set.status = 200;
            return graderService.findById(params.graderId);
        },
        { params: graderIdParamSchema },
    )
    .post(
        "/campaigns/:campaignId/graders",
        ({ params, body, set }) => {
            set.status = 201;
            return graderService.create(params.campaignId, body);
        },
        { params: graderCampaignParamSchema, body: createGraderBodySchema },
    )
    .patch(
        "/graders/:graderId",
        ({ params, body, set }) => {
            set.status = 200;
            return graderService.update(params.graderId, body);
        },
        { params: graderIdParamSchema, body: updateGraderBodySchema },
    )
    .delete(
        "/graders/:graderId",
        ({ params, set }) => {
            set.status = 200;
            return graderService.delete(params.graderId);
        },
        { params: graderIdParamSchema },
    );
