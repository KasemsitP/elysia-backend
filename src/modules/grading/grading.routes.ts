import { Elysia } from "elysia";
import { gradingService } from "./grading.service";
import { requireGradingAccess, requireGrader } from "../../cores/auth-guard";
import {
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
    .use(requireGrader())
    .post("/grading/preview-start",  ({ body, set }) => { set.status = 200; return gradingService.previewStart(body); },  { body: gradingStartBodySchema })
    .post("/grading/confirm-start",  ({ body, set }) => { set.status = 201; return gradingService.confirmStart(body); },  { body: gradingStartBodySchema })
    .post("/grading/drafts",         ({ body, set }) => { set.status = 201; return gradingService.saveDraft(body); },     { body: saveDraftBodySchema })
    .patch("/grading/drafts/:draftId",({ params, body, set }) => { set.status = 200; return gradingService.updateDraft(params.draftId, body); }, { params: draftIdParamSchema, body: updateDraftBodySchema })
    .post("/grading/confirm-bag",    ({ body, set }) => { set.status = 200; return gradingService.confirmBag(body); },    { body: confirmBagBodySchema })
    .post("/grading/work-locks",     ({ body, set }) => { set.status = 201; return gradingService.createWorkLock(body); },{ body: createWorkLockBodySchema });

// ADMIN / MANAGER / STAFF / GRADER — read + lock management
const sharedRoutes = new Elysia()
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

export const gradingRoutes = new Elysia().use(graderOnlyRoutes).use(sharedRoutes);
