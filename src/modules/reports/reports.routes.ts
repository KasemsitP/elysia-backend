import { Elysia } from "elysia";
import { reportService } from "./reports.service";
import { requireSession } from "../../cores/session";
import {
    reportBagParamSchema,
    reportCampaignParamSchema,
} from "./reports.schema";

export const reportRoutes = new Elysia({ prefix: "/reports" })
    .use(requireSession)
    // คะแนนทุกเล่มในถุง (รองรับ locked/unlocked mode)
    .get(
        "/bags/:bagId/scores",
        ({ params, set }) => {
            set.status = 200;
            return reportService.bagScores(params.bagId);
        },
        { params: reportBagParamSchema },
    )
    // PDF endpoints — return data เหมือนกัน (PDF rendering ต้อง integrate PDFKit + worker_threads เพิ่มเติม)
    .get(
        "/bags/:bagId/scores/pdf",
        ({ params, set }) => {
            set.status = 200;
            return reportService.bagScores(params.bagId);
        },
        { params: reportBagParamSchema },
    )
    .get(
        "/bags/:bagId/manual-score-sheet/pdf",
        ({ params, set }) => {
            set.status = 200;
            return reportService.bagScores(params.bagId);
        },
        { params: reportBagParamSchema },
    )
    // สรุปคะแนน campaign-level
    .get(
        "/campaigns/:campaignId/score-summary",
        ({ params, set }) => {
            set.status = 200;
            return reportService.campaignScoreSummary(params.campaignId);
        },
        { params: reportCampaignParamSchema },
    )
    // workload ของ grader แต่ละคน
    .get(
        "/campaigns/:campaignId/grader-workload",
        ({ params, set }) => {
            set.status = 200;
            return reportService.graderWorkload(params.campaignId);
        },
        { params: reportCampaignParamSchema },
    )
    // ค่าตรวจ
    .get(
        "/campaigns/:campaignId/grader-payment",
        ({ params, set }) => {
            set.status = 200;
            return reportService.graderPayment(params.campaignId);
        },
        { params: reportCampaignParamSchema },
    )
    // รายชื่อผู้ผ่าน
    .get(
        "/campaigns/:campaignId/passing-list",
        ({ params, set }) => {
            set.status = 200;
            return reportService.passingList(params.campaignId);
        },
        { params: reportCampaignParamSchema },
    );
