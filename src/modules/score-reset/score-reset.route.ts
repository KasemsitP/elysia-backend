import { Elysia } from "elysia";
import { scoreResetService } from "./score-reset.service";
import { requireSession } from "../../cores/session";
import { requireNonGrader } from "../../cores/auth-guard";
import {
    scoreResetCampaignParamSchema,
    scoreResetCaseParamSchema,
    scoreResetCasesQuerySchema,
    scoreResetVerifyScanBodySchema,
    scoreResetConfirmBodySchema,
} from "./score-reset.schema";

export const scoreResetRoutes = new Elysia({ prefix: "/score-reset" })
    .use(requireSession)
    .use(requireNonGrader())

    // GET /score-reset/campaigns/:campaignId/cases
    .get(
        "/campaigns/:campaignId/cases",
        ({ params, query, set }) => {
            set.status = 200;
            return scoreResetService.getCases(params.campaignId, query);
        },
        { params: scoreResetCampaignParamSchema, query: scoreResetCasesQuerySchema },
    )

    // POST /score-reset/campaigns/:campaignId/verify-scan
    .post(
        "/campaigns/:campaignId/verify-scan",
        ({ params, body, set }) => {
            set.status = 200;
            return scoreResetService.verifyScan(params.campaignId, body.qrPayload, body.caseId);
        },
        { params: scoreResetCampaignParamSchema, body: scoreResetVerifyScanBodySchema },
    )

    // POST /score-reset/campaigns/:campaignId/cases/:caseId/confirm
    .post(
        "/campaigns/:campaignId/cases/:caseId/confirm",
        ({ params, body, session, set }) => {
            set.status = 200;
            return scoreResetService.confirmReset(params.campaignId, params.caseId, body, session.account_id);
        },
        { params: scoreResetCaseParamSchema, body: scoreResetConfirmBodySchema },
    )

    // GET /score-reset/campaigns/:campaignId/bags
    .get(
        "/campaigns/:campaignId/bags",
        ({ params, set }) => {
            set.status = 200;
            return scoreResetService.getBags(params.campaignId);
        },
        { params: scoreResetCampaignParamSchema },
    )

    // GET /score-reset/campaigns/:campaignId/questions
    .get(
        "/campaigns/:campaignId/questions",
        ({ params, set }) => {
            set.status = 200;
            return scoreResetService.getQuestions(params.campaignId);
        },
        { params: scoreResetCampaignParamSchema },
    );
