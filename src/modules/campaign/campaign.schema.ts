import { t } from "elysia";

export const campaignIdParamSchema = t.Object({
    campaignId: t.Numeric(),
});

export const createCampaignBodySchema = t.Object({
    name: t.Optional(t.Nullable(t.String())),
    year_be: t.String(),
    site: t.Optional(t.Nullable(t.String())),
    campaign_size: t.String(),
    is_active: t.Optional(t.Boolean()),
    is_unlock: t.Optional(t.Boolean()),
    qr_active: t.Optional(t.Boolean()),
});

export const updateCampaignBodySchema = t.Object({
    name: t.Optional(t.Nullable(t.String())),
    year_be: t.Optional(t.String()),
    site: t.Optional(t.Nullable(t.String())),
    campaign_size: t.Optional(t.String()),
});

export const setActiveBodySchema = t.Object({
    is_active: t.Boolean(),
});

export const setQrActiveBodySchema = t.Object({
    qr_active: t.Boolean(),
});
