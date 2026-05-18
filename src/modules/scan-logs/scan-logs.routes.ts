import { Elysia } from "elysia";
import { scanLogService } from "./scan-logs.service";
import { requireSession } from "../../cores/session";
import {
    scanLogQuerySchema,
    scanLogCampaignParamSchema,
    scanLogBookletParamSchema,
    scanLogBagParamSchema,
} from "./scan-logs.schema";

export const scanLogRoutes = new Elysia()
    .use(requireSession)
    // ดู scan logs ทั้งหมด (admin/staff)
    .get(
        "/scan-logs",
        ({ query, set }) => {
            set.status = 200;
            return scanLogService.findAll(query);
        },
        { query: scanLogQuerySchema },
    )
    // ดู scan logs ของ campaign
    .get(
        "/campaigns/:campaignId/scan-logs",
        ({ params, query, set }) => {
            set.status = 200;
            return scanLogService.findByCampaign(params.campaignId, query);
        },
        { params: scanLogCampaignParamSchema, query: scanLogQuerySchema },
    )
    // ดู scan logs ของ booklet
    .get(
        "/booklets/:bookletId/scan-logs",
        ({ params, query, set }) => {
            set.status = 200;
            return scanLogService.findByBooklet(params.bookletId, query);
        },
        { params: scanLogBookletParamSchema, query: scanLogQuerySchema },
    )
    // ดู scan logs ของ bag
    .get(
        "/bags/:bagId/scan-logs",
        ({ params, query, set }) => {
            set.status = 200;
            return scanLogService.findByBag(params.bagId, query);
        },
        { params: scanLogBagParamSchema, query: scanLogQuerySchema },
    );
