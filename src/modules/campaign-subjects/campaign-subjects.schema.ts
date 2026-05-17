import { t } from "elysia";

export const campaignSubjectParentParamSchema = t.Object({
    campaignId: t.Numeric(),
});

export const campaignSubjectParamSchema = t.Object({
    campaignId: t.Numeric(),
    campaignSubjectId: t.Numeric(),
});

export const createCampaignSubjectBodySchema = t.Object({
    subject_id: t.Number(),
    code: t.String(),
    name: t.String(),
    full_score: t.Number(),
    order_no: t.Number(),
    active: t.Optional(t.Boolean()),
});

export const updateCampaignSubjectBodySchema = t.Object({
    code: t.Optional(t.String()),
    name: t.Optional(t.String()),
    full_score: t.Optional(t.Number()),
    order_no: t.Optional(t.Number()),
    active: t.Optional(t.Boolean()),
});
