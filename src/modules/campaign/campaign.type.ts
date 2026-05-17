import type { Static } from "elysia";
import type {
    campaignIdParamSchema,
    createCampaignBodySchema,
    updateCampaignBodySchema,
    setActiveBodySchema,
    setQrActiveBodySchema,
} from "./campaign.schema";

export type CampaignIdParam = Static<typeof campaignIdParamSchema>;
export type CreateCampaignBody = Static<typeof createCampaignBodySchema>;
export type UpdateCampaignBody = Static<typeof updateCampaignBodySchema>;
export type SetActiveBody = Static<typeof setActiveBodySchema>;
export type SetQrActiveBody = Static<typeof setQrActiveBodySchema>;
