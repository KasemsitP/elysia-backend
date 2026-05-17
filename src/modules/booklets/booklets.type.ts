import type { Static } from "elysia";
import type {
    bookletCampaignParamSchema,
    bookletGenerateParamSchema,
    bookletIdParamSchema,
    generateBookletsBodySchema,
    updateBookletBodySchema,
    bookletQuerySchema,
} from "./booklets.schema";

export type BookletCampaignParam = Static<typeof bookletCampaignParamSchema>;
export type BookletGenerateParam = Static<typeof bookletGenerateParamSchema>;
export type BookletIdParam = Static<typeof bookletIdParamSchema>;
export type GenerateBookletsBody = Static<typeof generateBookletsBodySchema>;
export type UpdateBookletBody = Static<typeof updateBookletBodySchema>;
export type BookletQuery = Static<typeof bookletQuerySchema>;
