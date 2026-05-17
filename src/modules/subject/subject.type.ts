import type { Static } from "elysia";
import type {
    subjectIdParamSchema,
    createSubjectBodySchema,
    updateSubjectBodySchema,
} from "./subject.schema";

export type SubjectIdParam = Static<typeof subjectIdParamSchema>;
export type CreateSubjectBody = Static<typeof createSubjectBodySchema>;
export type UpdateSubjectBody = Static<typeof updateSubjectBodySchema>;
