import { t } from "elysia";

export const sessionSubjectParentParamSchema = t.Object({
    campaignId: t.Numeric(),
    sessionId: t.Numeric(),
});

export const sessionSubjectParamSchema = t.Object({
    campaignId: t.Numeric(),
    sessionId: t.Numeric(),
    sessionSubjectId: t.Numeric(),
});

export const createSessionSubjectBodySchema = t.Object({
    campaign_subject_id: t.Number(),
    start_at: t.String(),
    end_at: t.String(),
    order_no: t.Number(),
});

export const updateSessionSubjectBodySchema = t.Object({
    start_at: t.Optional(t.String()),
    end_at: t.Optional(t.String()),
    order_no: t.Optional(t.Number()),
});
