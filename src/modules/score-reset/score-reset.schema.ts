import { t } from "elysia";

export const scoreResetCampaignParamSchema = t.Object({ campaignId: t.Numeric() });
export const scoreResetCaseParamSchema = t.Object({ campaignId: t.Numeric(), caseId: t.String() });
export const scoreResetCasesQuerySchema = t.Object({
    page: t.Optional(t.Numeric()),
    limit: t.Optional(t.Numeric()),
    bagId: t.Optional(t.Numeric()),
    sessionSubjectQuestionId: t.Optional(t.Numeric()),
    subjectId: t.Optional(t.Numeric()),
    status: t.Optional(t.Union([t.Literal("PENDING"), t.Literal("RESET_DONE"), t.Literal("ALL")])),
    sortBy: t.Optional(t.Union([t.Literal("bagNo"), t.Literal("questionNo"), t.Literal("difference"), t.Literal("randomNum")])),
    sortOrder: t.Optional(t.Union([t.Literal("asc"), t.Literal("desc")])),
    search: t.Optional(t.String()),
});
// caseId is optional — omit to auto-find all pending cases for the scanned booklet
export const scoreResetVerifyScanBodySchema = t.Object({
    qrPayload: t.String(),
    caseId: t.Optional(t.String()),
});
export const scoreResetConfirmBodySchema = t.Object({
    grader1Score: t.Number({ minimum: 0 }),
    grader2Score: t.Number({ minimum: 0 }),
});
