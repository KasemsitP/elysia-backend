import { t } from "elysia";

export const subjectIdParamSchema = t.Object({
    subjectId: t.Numeric(),
});

export const createSubjectBodySchema = t.Object({
    code: t.String(),
    name: t.String(),
    full_score: t.Optional(t.Number()),
    active: t.Optional(t.Boolean()),
});

export const updateSubjectBodySchema = t.Object({
    code: t.Optional(t.String()),
    name: t.Optional(t.String()),
    full_score: t.Optional(t.Number()),
    active: t.Optional(t.Boolean()),
});
