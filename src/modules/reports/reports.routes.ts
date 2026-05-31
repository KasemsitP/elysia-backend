import { Elysia } from "elysia";
import { reportService } from "./reports.service";
import { bagScoreReportService } from "./bag-score-report.service";
import { requireSession } from "../../cores/session";
import { requireNonGrader } from "../../cores/auth-guard";
import {
    reportBagParamSchema,
    reportCampaignParamSchema,
    reportCampaignBagParamSchema,
    reportCampaignBagsQuerySchema,
    reportBagScoreQuerySchema,
    reportAllBagsPdfQuerySchema,
} from "./reports.schema";

// Reports เข้าถึงได้เฉพาะ ADMIN, MANAGER, STAFF — ไม่รวม GRADER
export const reportRoutes = new Elysia({ prefix: "/reports" })
    .use(requireSession)
    .use(requireNonGrader())
    // ── Legacy bag score routes ─────────────────────────────────────────────────
    .get("/bags/:bagId/scores",             ({ params, set }) => { set.status = 200; return reportService.bagScores(params.bagId); },             { params: reportBagParamSchema })
    .get("/bags/:bagId/scores/pdf",         ({ params, set }) => { set.status = 200; return reportService.bagScoresPdf(params.bagId); },          { params: reportBagParamSchema })
    .get("/bags/:bagId/manual-score-sheet/pdf", ({ params, set }) => { set.status = 200; return reportService.manualScoreSheetPdf(params.bagId); }, { params: reportBagParamSchema })
    // ── Campaign-level reports ──────────────────────────────────────────────────
    .get("/campaigns/:campaignId/score-summary",   ({ params, set }) => { set.status = 200; return reportService.campaignScoreSummary(params.campaignId); },  { params: reportCampaignParamSchema })
    .get("/campaigns/:campaignId/grader-workload", ({ params, set }) => { set.status = 200; return reportService.graderWorkload(params.campaignId); },         { params: reportCampaignParamSchema })
    .get("/campaigns/:campaignId/grader-payment",  ({ params, set }) => { set.status = 200; return reportService.graderPayment(params.campaignId); },          { params: reportCampaignParamSchema })
    .get("/campaigns/:campaignId/passing-list",    ({ params, set }) => { set.status = 200; return reportService.passingList(params.campaignId); },            { params: reportCampaignParamSchema })
    // ── Bag score report (new) ──────────────────────────────────────────────────
    // NOTE: static "/bags/scores/pdf" must be declared before "/:bagId" routes to avoid routing conflict
    .get(
        "/campaigns/:campaignId/bags",
        ({ params, query, set }) => {
            set.status = 200;
            return bagScoreReportService.getBagsForDropdown(params.campaignId, {
                sessionId: query.sessionId,
                search: query.search,
            });
        },
        { params: reportCampaignParamSchema, query: reportCampaignBagsQuerySchema },
    )
    .get(
        "/campaigns/:campaignId/bags/scores/pdf",
        ({ params, query, set }) => {
            set.status = 200;
            return bagScoreReportService.getAllBagScorePdf(params.campaignId, query.sessionId);
        },
        { params: reportCampaignParamSchema, query: reportAllBagsPdfQuerySchema },
    )
    .get(
        "/campaigns/:campaignId/bags/:bagId/scores",
        ({ params, query, set }) => {
            set.status = 200;
            return bagScoreReportService.getBagScoreReport(
                params.campaignId,
                params.bagId,
                query.differenceThreshold,
            );
        },
        { params: reportCampaignBagParamSchema, query: reportBagScoreQuerySchema },
    )
    .get(
        "/campaigns/:campaignId/bags/:bagId/scores/pdf",
        ({ params, set }) => {
            set.status = 200;
            return bagScoreReportService.getBagScorePdf(params.campaignId, params.bagId);
        },
        { params: reportCampaignBagParamSchema },
    );
