import type { Static } from "elysia";
import type {
    settingCampaignParamSchema,
    settingKeyParamSchema,
    createSettingBodySchema,
    updateSettingBodySchema,
} from "./campaign-settings.schema";

export type SettingCampaignParam = Static<typeof settingCampaignParamSchema>;
export type SettingKeyParam = Static<typeof settingKeyParamSchema>;
export type CreateSettingBody = Static<typeof createSettingBodySchema>;
export type UpdateSettingBody = Static<typeof updateSettingBodySchema>;

export type ValueType = "STRING" | "NUMBER" | "BOOLEAN" | "JSON" | "DATE";
