import type { Static } from "elysia";
import type {
    bookletNoteParentParamSchema,
    bookletNoteIdParamSchema,
    createNoteBodySchema,
    updateNoteBodySchema,
    reviewNoteBodySchema,
} from "./booklet-notes.schema";

export type BookletNoteParentParam = Static<typeof bookletNoteParentParamSchema>;
export type BookletNoteIdParam = Static<typeof bookletNoteIdParamSchema>;
export type CreateNoteBody = Static<typeof createNoteBodySchema>;
export type UpdateNoteBody = Static<typeof updateNoteBodySchema>;
export type ReviewNoteBody = Static<typeof reviewNoteBodySchema>;
