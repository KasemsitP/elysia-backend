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
