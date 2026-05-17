import type { Static } from "elysia";
import type {
    reportBagParamSchema,
    reportCampaignParamSchema,
} from "./reports.schema";

export type ReportBagParam = Static<typeof reportBagParamSchema>;
export type ReportCampaignParam = Static<typeof reportCampaignParamSchema>;
