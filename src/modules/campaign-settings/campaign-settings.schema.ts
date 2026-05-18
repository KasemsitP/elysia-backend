import { t } from "elysia";

export const settingCampaignParamSchema = t.Object({
    campaignId: t.Numeric(),
});

export const settingKeyParamSchema = t.Object({
    campaignId: t.Numeric(),
    key: t.String(),
});

export const createSettingBodySchema = t.Object({
    setting_key: t.String(),
    setting_value: t.Any(),
    value_type: t.Optional(
        t.Union([
            t.Literal("STRING"),
            t.Literal("NUMBER"),
            t.Literal("BOOLEAN"),
            t.Literal("JSON"),
            t.Literal("DATE"),
        ]),
    ),
    description: t.Optional(t.Nullable(t.String())),
});

export const updateSettingBodySchema = t.Object({
    setting_value: t.Any(),
    value_type: t.Optional(
        t.Union([
            t.Literal("STRING"),
            t.Literal("NUMBER"),
            t.Literal("BOOLEAN"),
            t.Literal("JSON"),
            t.Literal("DATE"),
        ]),
    ),
    description: t.Optional(t.Nullable(t.String())),
    active: t.Optional(t.Boolean()),
});
