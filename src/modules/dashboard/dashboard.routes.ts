import { Elysia } from "elysia";
import { dashboardService } from "./dashboard.service";
import { requireSession } from "../../cores/session";
import { requireNonGrader } from "../../cores/auth-guard";
import { campaignIdQuerySchema, recentActivitiesQuerySchema } from "./dashboard.schema";

export const dashboardRoutes = new Elysia({ prefix: "/dashboard" })
    .use(requireSession)
    .use(requireNonGrader())
    .get("/overview",          ({ set }) => { set.status = 200; return dashboardService.overview(); })
    .get("/workflow",          ({ query, set }) => { set.status = 200; return dashboardService.workflow(query.campaignId); },                    { query: campaignIdQuerySchema })
    .get("/recent-activities", ({ query, set }) => { set.status = 200; return dashboardService.recentActivities(query.campaignId, query.limit); }, { query: recentActivitiesQuerySchema })
    .get("/active-campaign",   ({ set }) => { set.status = 200; return dashboardService.activeCampaigns(); })
    .get("/grading/unlock-checklist", ({ query, set }) => { set.status = 200; return dashboardService.unlockChecklist(query.campaignId); },       { query: campaignIdQuerySchema })
    .get("/grading",           ({ query, set }) => { set.status = 200; return dashboardService.grading(query.campaignId); },                       { query: campaignIdQuerySchema });
