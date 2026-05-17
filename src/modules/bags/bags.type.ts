import type { Static } from "elysia";
import type {
    bagCampaignParamSchema,
    bagCampaignSessionParamSchema,
    bagIdParamSchema,
    scanPreviewBodySchema,
    createBagBodySchema,
    updateBagStatusBodySchema,
} from "./bags.schema";

export type BagCampaignParam = Static<typeof bagCampaignParamSchema>;
export type BagCampaignSessionParam = Static<typeof bagCampaignSessionParamSchema>;
export type BagIdParam = Static<typeof bagIdParamSchema>;
export type ScanPreviewBody = Static<typeof scanPreviewBodySchema>;
export type CreateBagBody = Static<typeof createBagBodySchema>;
export type UpdateBagStatusBody = Static<typeof updateBagStatusBodySchema>;
