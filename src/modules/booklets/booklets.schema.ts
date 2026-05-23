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
    user_codes: t.Array(t.String({ minLength: 1 }), { minItems: 1, maxItems: 10000 }),
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
