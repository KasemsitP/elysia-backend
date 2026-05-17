import { t } from "elysia";

export const sessionCampaignParamSchema = t.Object({
    campaignId: t.Numeric(),
});

export const sessionParamSchema = t.Object({
    campaignId: t.Numeric(),
    sessionId: t.Numeric(),
});

export const createSessionBodySchema = t.Object({
    session_code: t.String(),
    title: t.Optional(t.Nullable(t.String())),
    exam_date: t.String(),
    day_no: t.Number(),
});

export const updateSessionBodySchema = t.Object({
    session_code: t.Optional(t.String()),
    title: t.Optional(t.Nullable(t.String())),
    exam_date: t.Optional(t.String()),
    day_no: t.Optional(t.Number()),
});
