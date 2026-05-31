import type { Static } from "elysia";
import type {
    reportBagParamSchema,
    reportCampaignParamSchema,
    reportCampaignBagParamSchema,
    reportCampaignBagsQuerySchema,
    reportBagScoreQuerySchema,
    reportAllBagsPdfQuerySchema,
} from "./reports.schema";

export type ReportBagParam = Static<typeof reportBagParamSchema>;
export type ReportCampaignParam = Static<typeof reportCampaignParamSchema>;
export type ReportCampaignBagParam = Static<typeof reportCampaignBagParamSchema>;
export type ReportCampaignBagsQuery = Static<typeof reportCampaignBagsQuerySchema>;
export type ReportBagScoreQuery = Static<typeof reportBagScoreQuerySchema>;
export type ReportAllBagsPdfQuery = Static<typeof reportAllBagsPdfQuerySchema>;
