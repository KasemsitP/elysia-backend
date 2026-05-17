import { t } from "elysia";

export const bookletCampaignParamSchema = t.Object({
    campaignId: t.Numeric(),
});

export const bookletGenerateParamSchema = t.Object({
    campaignId: t.Numeric(),
    sessionId: t.Numeric(),
});

export const bookletIdParamSchema = t.Object({
    bookletId: t.Numeric(),
});

export const generateBookletsBodySchema = t.Object({
    count: t.Number({ minimum: 1, maximum: 500 }),
});

export const updateBookletBodySchema = t.Object({
    status: t.Optional(t.String()),
    user_code: t.Optional(t.Nullable(t.String())),
});

export const bookletQuerySchema = t.Object({
    session_id: t.Optional(t.Numeric()),
    status: t.Optional(t.String()),
    page: t.Optional(t.Numeric()),
    limit: t.Optional(t.Numeric()),
});
