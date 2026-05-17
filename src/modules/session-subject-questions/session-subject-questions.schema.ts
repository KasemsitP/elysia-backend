import { t } from "elysia";

export const sessionQuestionsParamSchema = t.Object({
    campaignId: t.Numeric(),
    sessionId: t.Numeric(),
});

export const sessionSubjectIdParamSchema = t.Object({
    sessionSubjectId: t.Numeric(),
});

export const questionIdParamSchema = t.Object({
    questionId: t.Numeric(),
});

export const createQuestionBodySchema = t.Object({
    question_no: t.Number(),
    label: t.String(),
    max_score: t.Optional(t.Number()),
    question_type: t.Optional(t.Union([t.Literal("REQUIRED"), t.Literal("OPTIONAL")])),
    note: t.Optional(t.Nullable(t.String())),
});

export const updateQuestionBodySchema = t.Object({
    question_no: t.Optional(t.Number()),
    label: t.Optional(t.String()),
    max_score: t.Optional(t.Number()),
    question_type: t.Optional(t.Union([t.Literal("REQUIRED"), t.Literal("OPTIONAL")])),
    note: t.Optional(t.Nullable(t.String())),
});
