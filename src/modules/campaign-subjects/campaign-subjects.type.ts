import type { Static } from "elysia";
import type {
    campaignSubjectParentParamSchema,
    campaignSubjectParamSchema,
    createCampaignSubjectBodySchema,
    updateCampaignSubjectBodySchema,
} from "./campaign-subjects.schema";

export type CampaignSubjectParentParam = Static<typeof campaignSubjectParentParamSchema>;
export type CampaignSubjectParam = Static<typeof campaignSubjectParamSchema>;
export type CreateCampaignSubjectBody = Static<typeof createCampaignSubjectBodySchema>;
export type UpdateCampaignSubjectBody = Static<typeof updateCampaignSubjectBodySchema>;
