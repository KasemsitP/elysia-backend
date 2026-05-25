import type { Static } from "elysia";
import type {
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

// ── New campaign-scoped types ────────────────────────────────────────────────
export type CampaignIdParam = Static<typeof campaignIdParamSchema>;
export type VerifyFirstScanBody = Static<typeof verifyFirstScanBodySchema>;
export type StartWorkBody = Static<typeof startWorkBodySchema>;
export type SaveDraftScoreBody = Static<typeof saveDraftScoreBodySchema>;
export type ConfirmWorkBody = Static<typeof confirmWorkBodySchema>;
export type CancelWorkBody = Static<typeof cancelWorkBodySchema>;

// ── Legacy types ─────────────────────────────────────────────────────────────
export type GraderIdParam = Static<typeof graderIdParamSchema>;
export type BagGraderParam = Static<typeof bagGraderParamSchema>;
export type DraftIdParam = Static<typeof draftIdParamSchema>;
export type LockIdParam = Static<typeof lockIdParamSchema>;
export type GradingStartBody = Static<typeof gradingStartBodySchema>;
export type SaveDraftBody = Static<typeof saveDraftBodySchema>;
export type UpdateDraftBody = Static<typeof updateDraftBodySchema>;
export type ConfirmBagBody = Static<typeof confirmBagBodySchema>;
export type CreateWorkLockBody = Static<typeof createWorkLockBodySchema>;
