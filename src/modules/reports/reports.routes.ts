import { Elysia } from "elysia";
import { reportService } from "./reports.service";
import { requireSession } from "../../cores/session";
import { requireNonGrader } from "../../cores/auth-guard";
import { reportBagParamSchema, reportCampaignParamSchema } from "./reports.schema";

// Reports เข้าถึงได้เฉพาะ ADMIN, MANAGER, STAFF — ไม่รวม GRADER
export const reportRoutes = new Elysia({ prefix: "/reports" })
    .use(requireSession)
    .use(requireNonGrader())
    .get("/bags/:bagId/scores",             ({ params, set }) => { set.status = 200; return reportService.bagScores(params.bagId); },             { params: reportBagParamSchema })
    .get("/bags/:bagId/scores/pdf",         ({ params, set }) => { set.status = 200; return reportService.bagScoresPdf(params.bagId); },          { params: reportBagParamSchema })
    .get("/bags/:bagId/manual-score-sheet/pdf", ({ params, set }) => { set.status = 200; return reportService.manualScoreSheetPdf(params.bagId); }, { params: reportBagParamSchema })
    .get("/campaigns/:campaignId/score-summary",   ({ params, set }) => { set.status = 200; return reportService.campaignScoreSummary(params.campaignId); },  { params: reportCampaignParamSchema })
    .get("/campaigns/:campaignId/grader-workload", ({ params, set }) => { set.status = 200; return reportService.graderWorkload(params.campaignId); },         { params: reportCampaignParamSchema })
    .get("/campaigns/:campaignId/grader-payment",  ({ params, set }) => { set.status = 200; return reportService.graderPayment(params.campaignId); },          { params: reportCampaignParamSchema })
    .get("/campaigns/:campaignId/passing-list",    ({ params, set }) => { set.status = 200; return reportService.passingList(params.campaignId); },            { params: reportCampaignParamSchema });
