import { Elysia } from "elysia";
import { userCampaignService } from "./user-campaigns.service";
import { requireSession } from "../../cores/session";
import {
    candidateCampaignParamSchema,
    candidateParamSchema,
    sessionCandidateParentSchema,
    sessionCandidateParamSchema,
    createCandidateBodySchema,
    updateCandidateBodySchema,
    createSessionCandidateBodySchema,
} from "./user-campaigns.schema";

export const userCampaignRoutes = new Elysia()
    .use(requireSession)
    // ── Candidates (/campaigns/:id/candidates) ───────────────────────────────
    .get(
        "/campaigns/:campaignId/candidates",
        ({ params, set }) => {
            set.status = 200;
            return userCampaignService.findByCampaign(params.campaignId);
        },
        { params: candidateCampaignParamSchema },
    )
    .post(
        "/campaigns/:campaignId/candidates",
        ({ params, body, set }) => {
            set.status = 201;
            return userCampaignService.addCandidate(params.campaignId, body);
        },
        { params: candidateCampaignParamSchema, body: createCandidateBodySchema },
    )
    .patch(
        "/campaigns/:campaignId/candidates/:userCampaignId",
        ({ params, body, set }) => {
            set.status = 200;
            return userCampaignService.updateSeat(params.campaignId, params.userCampaignId, body);
        },
        { params: candidateParamSchema, body: updateCandidateBodySchema },
    )
    .delete(
        "/campaigns/:campaignId/candidates/:userCampaignId",
        ({ params, set }) => {
            set.status = 200;
            return userCampaignService.removeCandidate(params.campaignId, params.userCampaignId);
        },
        { params: candidateParamSchema },
    )
    // ── Session Candidates (/campaigns/:id/sessions/:sid/candidates) ─────────
    .get(
        "/campaigns/:campaignId/sessions/:sessionId/candidates",
        ({ params, set }) => {
            set.status = 200;
            return userCampaignService.findSessionCandidates(params.campaignId, params.sessionId);
        },
        { params: sessionCandidateParentSchema },
    )
    .post(
        "/campaigns/:campaignId/sessions/:sessionId/candidates",
        ({ params, body, set }) => {
            set.status = 201;
            return userCampaignService.addSessionCandidate(
                params.campaignId,
                params.sessionId,
                body.user_campaign_id,
            );
        },
        { params: sessionCandidateParentSchema, body: createSessionCandidateBodySchema },
    )
    .delete(
        "/campaigns/:campaignId/sessions/:sessionId/candidates/:userSessionId",
        ({ params, set }) => {
            set.status = 200;
            return userCampaignService.removeSessionCandidate(
                params.campaignId,
                params.sessionId,
                params.userSessionId,
            );
        },
        { params: sessionCandidateParamSchema },
    );
