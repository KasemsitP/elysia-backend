import { t } from "elysia";

export const scanLogQuerySchema = t.Object({
    campaignId: t.Optional(t.Numeric()),
    sessionId: t.Optional(t.Numeric()),
    bagId: t.Optional(t.Numeric()),
    bookletId: t.Optional(t.Numeric()),
    scanContext: t.Optional(t.String()),
    scanResult: t.Optional(t.String()),
    scannedByAccountId: t.Optional(t.Numeric()),
    scannedByGraderId: t.Optional(t.Numeric()),
    dateFrom: t.Optional(t.String()),
    dateTo: t.Optional(t.String()),
    page: t.Optional(t.Numeric()),
    limit: t.Optional(t.Numeric()),
});

export const scanLogCampaignParamSchema = t.Object({
    campaignId: t.Numeric(),
});

export const scanLogBookletParamSchema = t.Object({
    bookletId: t.Numeric(),
});

export const scanLogBagParamSchema = t.Object({
    bagId: t.Numeric(),
});
