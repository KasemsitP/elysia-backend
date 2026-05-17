import { Elysia } from "elysia";
import { gradingService } from "./grading.service";
import { requireSession } from "../../cores/session";
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

export const gradingRoutes = new Elysia()
    .use(requireSession)
    // Preview: ตรวจสอบก่อนเริ่มตรวจ (ไม่มี side effect)
    .post(
        "/grading/preview-start",
        ({ body, set }) => {
            set.status = 200;
            return gradingService.previewStart(body);
        },
        { body: gradingStartBodySchema },
    )
    // Confirm: สร้าง slot + lock แล้วเริ่มตรวจได้
    .post(
        "/grading/confirm-start",
        ({ body, set }) => {
            set.status = 201;
            return gradingService.confirmStart(body);
        },
        { body: gradingStartBodySchema },
    )
    // บันทึกคะแนน draft
    .post(
        "/grading/drafts",
        ({ body, set }) => {
            set.status = 201;
            return gradingService.saveDraft(body);
        },
        { body: saveDraftBodySchema },
    )
    .patch(
        "/grading/drafts/:draftId",
        ({ params, body, set }) => {
            set.status = 200;
            return gradingService.updateDraft(params.draftId, body);
        },
        { params: draftIdParamSchema, body: updateDraftBodySchema },
    )
    // ดึง draft ที่ยังค้างของ grader
    .get(
        "/graders/:graderId/drafts/active",
        ({ params, set }) => {
            set.status = 200;
            return gradingService.getActiveDrafts(params.graderId);
        },
        { params: graderIdParamSchema },
    )
    .get(
        "/bags/:bagId/graders/:graderId/drafts",
        ({ params, set }) => {
            set.status = 200;
            return gradingService.getDraftsByGraderAndBag(params.bagId, params.graderId);
        },
        { params: bagGraderParamSchema },
    )
    // ยืนยันคะแนนทั้งถุง
    .post(
        "/grading/confirm-bag",
        ({ body, set }) => {
            set.status = 200;
            return gradingService.confirmBag(body);
        },
        { body: confirmBagBodySchema },
    )
    // Work locks
    .get(
        "/graders/:graderId/work-lock",
        ({ params, set }) => {
            set.status = 200;
            return gradingService.getActiveLock(params.graderId);
        },
        { params: graderIdParamSchema },
    )
    .post(
        "/grading/work-locks",
        ({ body, set }) => {
            set.status = 201;
            return gradingService.createWorkLock(body);
        },
        { body: createWorkLockBodySchema },
    )
    .patch(
        "/grading/work-locks/:lockId/release",
        ({ params, set }) => {
            set.status = 200;
            return gradingService.releaseLock(params.lockId);
        },
        { params: lockIdParamSchema },
    )
    .patch(
        "/grading/work-locks/:lockId/cancel",
        ({ params, set }) => {
            set.status = 200;
            return gradingService.cancelLock(params.lockId);
        },
        { params: lockIdParamSchema },
    );
