import { t } from "elysia";

export const bookletNoteParentParamSchema = t.Object({
    bookletId: t.Numeric(),
});

export const bookletNoteIdParamSchema = t.Object({
    noteId: t.Numeric(),
});

export const createNoteBodySchema = t.Object({
    session_subject_question_id: t.Number(),
    slot_id: t.Optional(t.Nullable(t.Number())),
    note_type: t.Optional(t.Union([t.Literal("GENERAL"), t.Literal("SUSPICIOUS"), t.Literal("MISSING"), t.Literal("DAMAGED")])),
    severity: t.Optional(t.Union([t.Literal("LOW"), t.Literal("MEDIUM"), t.Literal("HIGH")])),
    note: t.String(),
});

export const updateNoteBodySchema = t.Object({
    note_type: t.Optional(t.String()),
    severity: t.Optional(t.String()),
    note: t.Optional(t.String()),
});

export const reviewNoteBodySchema = t.Object({
    status: t.Union([t.Literal("REVIEWED"), t.Literal("RESOLVED"), t.Literal("DISMISSED")]),
    resolution_note: t.Optional(t.Nullable(t.String())),
});
