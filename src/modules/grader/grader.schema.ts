import { t } from "elysia";

export const graderCampaignParamSchema = t.Object({
    campaignId: t.Numeric(),
});

export const graderIdParamSchema = t.Object({
    graderId: t.Numeric(),
});

export const createGraderBodySchema = t.Object({
    account_id: t.Number(),
});

export const updateGraderBodySchema = t.Object({
    active: t.Boolean(),
});
