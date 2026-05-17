import type { Static } from "elysia";
import type {
    sessionSubjectParentParamSchema,
    sessionSubjectParamSchema,
    createSessionSubjectBodySchema,
    updateSessionSubjectBodySchema,
} from "./session-subjects.schema";

export type SessionSubjectParentParam = Static<typeof sessionSubjectParentParamSchema>;
export type SessionSubjectParam = Static<typeof sessionSubjectParamSchema>;
export type CreateSessionSubjectBody = Static<typeof createSessionSubjectBodySchema>;
export type UpdateSessionSubjectBody = Static<typeof updateSessionSubjectBodySchema>;
