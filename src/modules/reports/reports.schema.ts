import { t } from "elysia";

export const reportBagParamSchema = t.Object({
    bagId: t.Numeric(),
});

export const reportCampaignParamSchema = t.Object({
    campaignId: t.Numeric(),
});

export const reportCampaignSessionParamSchema = t.Object({
    campaignId: t.Numeric(),
    sessionId: t.Numeric(),
});

export const reportCampaignBagParamSchema = t.Object({
    campaignId: t.Numeric(),
    bagId: t.Numeric(),
});

export const reportCampaignBagsQuerySchema = t.Object({
    sessionId: t.Optional(t.Numeric()),
    search: t.Optional(t.String()),
});

export const reportBagScoreQuerySchema = t.Object({
    differenceThreshold: t.Optional(t.Numeric()),
});

export const reportAllBagsPdfQuerySchema = t.Object({
    sessionId: t.Optional(t.Numeric()),
});
