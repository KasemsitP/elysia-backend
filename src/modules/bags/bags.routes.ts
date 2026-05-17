import { Elysia } from "elysia";
import { bagService } from "./bags.service";
import { requireSession } from "../../cores/session";
import {
    bagCampaignParamSchema,
    bagCampaignSessionParamSchema,
    bagIdParamSchema,
    scanPreviewBodySchema,
    createBagBodySchema,
    updateBagStatusBodySchema,
} from "./bags.schema";

export const bagRoutes = new Elysia()
    .use(requireSession)
    // Preview: ตรวจ qr_payloads ก่อนสร้างถุง ไม่มี side effect
    .post(
        "/bags/scan/preview",
        ({ body, set }) => {
            set.status = 200;
            return bagService.scanPreview(body);
        },
        { body: scanPreviewBodySchema },
    )
    // สร้างถุงจริง (มี SELECT FOR UPDATE)
    .post(
        "/bags",
        ({ body, session, set }) => {
            set.status = 201;
            return bagService.create(body, session);
        },
        { body: createBagBodySchema },
    )
    .get(
        "/campaigns/:campaignId/bags",
        ({ params, set }) => {
            set.status = 200;
            return bagService.findByCampaign(params.campaignId);
        },
        { params: bagCampaignParamSchema },
    )
    .get(
        "/campaigns/:campaignId/sessions/:sessionId/bags",
        ({ params, set }) => {
            set.status = 200;
            return bagService.findByCampaignAndSession(params.campaignId, params.sessionId);
        },
        { params: bagCampaignSessionParamSchema },
    )
    .get(
        "/bags/:bagId",
        ({ params, set }) => {
            set.status = 200;
            return bagService.findById(params.bagId);
        },
        { params: bagIdParamSchema },
    )
    .get(
        "/bags/:bagId/booklets",
        ({ params, set }) => {
            set.status = 200;
            return bagService.findBooklets(params.bagId);
        },
        { params: bagIdParamSchema },
    )
    .get(
        "/bags/:bagId/summary",
        ({ params, set }) => {
            set.status = 200;
            return bagService.findSummary(params.bagId);
        },
        { params: bagIdParamSchema },
    )
    .patch(
        "/bags/:bagId/status",
        ({ params, body, set }) => {
            set.status = 200;
            return bagService.updateStatus(params.bagId, body);
        },
        { params: bagIdParamSchema, body: updateBagStatusBodySchema },
    )
    .delete(
        "/bags/:bagId",
        ({ params, set }) => {
            set.status = 200;
            return bagService.delete(params.bagId);
        },
        { params: bagIdParamSchema },
    );
