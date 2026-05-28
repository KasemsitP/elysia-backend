import { Elysia } from "elysia";
import { gradingService } from "./grading.service";
import { requireSession } from "../../cores/session";
import { requireGradingAccess, requireGrader } from "../../cores/auth-guard";
import {
    campaignIdParamSchema,
    verifyFirstScanBodySchema,
    startWorkBodySchema,
    saveDraftScoreBodySchema,
    confirmWorkBodySchema,
    cancelWorkBodySchema,
    graderIdParamSchema,
    bagGraderParamSchema,
    draftIdParamSchema,
    lockIdParamSchema,
    gradingStartBodySchema,
    saveDraftBodySchema,
    updateDraftBodySchema,
    confirmBagBodySchema,
    createWorkLockBodySchema,
} from "./grading.schema";

// GRADER-only operations (ตรวจสอบว่า grader_id ตรงกับ session ใน service)
const graderOnlyRoutes = new Elysia()
    .use(requireSession)
    .use(requireGrader())
    .post("/grading/preview-start",  ({ body, set }) => { set.status = 200; return gradingService.previewStart(body); },  { body: gradingStartBodySchema })
    .post("/grading/confirm-start",  ({ body, set }) => { set.status = 201; return gradingService.confirmStart(body); },  { body: gradingStartBodySchema })
    .post("/grading/drafts",         ({ body, set }) => { set.status = 201; return gradingService.saveDraft(body); },     { body: saveDraftBodySchema })
    .patch("/grading/drafts/:draftId",({ params, body, session, set }) => { set.status = 200; return gradingService.updateDraft(params.draftId, session.grader_id!, body); }, { params: draftIdParamSchema, body: updateDraftBodySchema })
    .post("/grading/confirm-bag",    ({ body, set }) => { set.status = 200; return gradingService.confirmBag(body); },    { body: confirmBagBodySchema })
    .post("/grading/work-locks",     ({ body, set }) => { set.status = 201; return gradingService.createWorkLock(body); },{ body: createWorkLockBodySchema });

// ADMIN / MANAGER / STAFF / GRADER — read + lock management
const sharedRoutes = new Elysia()
    .use(requireSession)
    .use(requireGradingAccess())
    .get("/graders/:graderId/drafts/active", ({ params, set }) => {
        set.status = 200; return gradingService.getActiveDrafts(params.graderId);
    }, { params: graderIdParamSchema })
    .get("/bags/:bagId/graders/:graderId/drafts", ({ params, set }) => {
        set.status = 200; return gradingService.getDraftsByGraderAndBag(params.bagId, params.graderId);
    }, { params: bagGraderParamSchema })
    .get("/graders/:graderId/work-lock", ({ params, set }) => {
        set.status = 200; return gradingService.getActiveLock(params.graderId);
    }, { params: graderIdParamSchema })
    .patch("/grading/work-locks/:lockId/release", ({ params, set }) => {
        set.status = 200; return gradingService.releaseLock(params.lockId);
    }, { params: lockIdParamSchema })
    .patch("/grading/work-locks/:lockId/cancel", ({ params, set }) => {
        set.status = 200; return gradingService.cancelLock(params.lockId);
    }, { params: lockIdParamSchema });

// ── Campaign-scoped GRADER-only routes (session-inferred grader) ─────────────
const graderCampaignRoutes = new Elysia()
    .use(requireSession)
    .use(requireGrader())
    .get(
        "/grading/campaigns/:campaignId/my-questions",
        ({ params, session, set }) => {
            set.status = 200;
            return gradingService.getMyQuestions(params.campaignId, session.account_id);
        },
        { params: campaignIdParamSchema },
    )
    .get(
        "/grading/campaigns/:campaignId/active-work",
        ({ params, session, set }) => {
            set.status = 200;
            return gradingService.getActiveWork(params.campaignId, session.account_id);
        },
        { params: campaignIdParamSchema },
    )
    .post(
        "/grading/campaigns/:campaignId/verify-first-scan",
        ({ params, body, session, set }) => {
            set.status = 200;
            return gradingService.verifyFirstScan(params.campaignId, session.account_id, body);
        },
        { params: campaignIdParamSchema, body: verifyFirstScanBodySchema },
    )
    .post(
        "/grading/campaigns/:campaignId/start-work",
        ({ params, body, session, set }) => {
            set.status = 201;
            return gradingService.startWork(params.campaignId, session.account_id, body);
        },
        { params: campaignIdParamSchema, body: startWorkBodySchema },
    )
    .post(
        "/grading/campaigns/:campaignId/drafts",
        ({ params, body, session, set }) => {
            set.status = 200;
            return gradingService.saveDraftScore(params.campaignId, session.account_id, body);
        },
        { params: campaignIdParamSchema, body: saveDraftScoreBodySchema },
    )
    .post(
        "/grading/campaigns/:campaignId/confirm-work",
        ({ params, body, session, set }) => {
            set.status = 200;
            return gradingService.confirmWork(params.campaignId, session.account_id, body);
        },
        { params: campaignIdParamSchema, body: confirmWorkBodySchema },
    )
    .post(
        "/grading/campaigns/:campaignId/cancel-work",
        ({ params, body, session, set }) => {
            set.status = 200;
            return gradingService.cancelWork(params.campaignId, session.account_id, body);
        },
        { params: campaignIdParamSchema, body: cancelWorkBodySchema },
    );

export const gradingRoutes = new Elysia()
    .use(graderCampaignRoutes)
    .use(graderOnlyRoutes)
    .use(sharedRoutes);
