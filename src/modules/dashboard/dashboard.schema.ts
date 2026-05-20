import { t } from "elysia";

export const campaignIdQuerySchema = t.Object({
    campaignId: t.Numeric(),
});

export const recentActivitiesQuerySchema = t.Object({
    campaignId: t.Optional(t.Numeric()),
    limit: t.Optional(t.Numeric()),
});
