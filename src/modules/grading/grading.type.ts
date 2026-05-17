import type { Static } from "elysia";
import type {
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

export type GraderIdParam = Static<typeof graderIdParamSchema>;
export type BagGraderParam = Static<typeof bagGraderParamSchema>;
export type DraftIdParam = Static<typeof draftIdParamSchema>;
export type LockIdParam = Static<typeof lockIdParamSchema>;
export type GradingStartBody = Static<typeof gradingStartBodySchema>;
export type SaveDraftBody = Static<typeof saveDraftBodySchema>;
export type UpdateDraftBody = Static<typeof updateDraftBodySchema>;
export type ConfirmBagBody = Static<typeof confirmBagBodySchema>;
export type CreateWorkLockBody = Static<typeof createWorkLockBodySchema>;
