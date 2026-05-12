import type { Static } from "elysia";
import type { campaignQuerySchema, updateBodySchema, createBodySchema } from "./campaign.schema";
import type { campaignRepo } from "./campaign.repo";

export type CampaignQuerySchema = Static<typeof campaignQuerySchema>;
export type UpdateBodySchema = Static<typeof updateBodySchema>;
export type CreateBodySchema = Static<typeof createBodySchema>;

export type CampaignWithDetails = NonNullable<Awaited<ReturnType<typeof campaignRepo.findCampaignWithSessionsAndSubjects>>>;
export type CampaignList = Awaited<ReturnType<typeof campaignRepo.findAllCampaignWithSessionsAndSubjects>>;
