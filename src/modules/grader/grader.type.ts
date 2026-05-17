import type { Static } from "elysia";
import type {
    graderCampaignParamSchema,
    graderIdParamSchema,
    createGraderBodySchema,
    updateGraderBodySchema,
} from "./grader.schema";

export type GraderCampaignParam = Static<typeof graderCampaignParamSchema>;
export type GraderIdParam = Static<typeof graderIdParamSchema>;
export type CreateGraderBody = Static<typeof createGraderBodySchema>;
export type UpdateGraderBody = Static<typeof updateGraderBodySchema>;
