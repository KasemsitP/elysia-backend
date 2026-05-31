import { Elysia } from "elysia";
import { bookletService } from "./booklets.service";
import { requireSession } from "../../cores/session";
import { requireAdmin } from "../../cores/auth-guard";
import {
    bookletCampaignParamSchema,
    bookletGenerateParamSchema,
    bookletIdParamSchema,
    generateBookletsBodySchema,
    updateBookletBodySchema,
    bookletQuerySchema,
} from "./booklets.schema";

export const bookletRoutes = new Elysia()
    .use(requireSession)
    .get(
        "/campaigns/:campaignId/booklets",
        ({ params, query, set }) => {
            set.status = 200;
            return bookletService.findByCampaign(params.campaignId, query);
        },
        { params: bookletCampaignParamSchema, query: bookletQuerySchema },
    )
    .get(
        "/booklets/:bookletId",
        ({ params, set }) => {
            set.status = 200;
            return bookletService.findById(params.bookletId);
        },
        { params: bookletIdParamSchema },
    )
    .post(
        "/campaigns/:campaignId/booklets/generate-all",
        ({ params, set }) => {
            set.status = 201;
            return bookletService.generateAll(params.campaignId);
        },
        { params: bookletCampaignParamSchema },
    )
    .post(
        "/campaigns/:campaignId/sessions/:sessionId/booklets/generate",
        ({ params, body, set }) => {
            set.status = 201;
            return bookletService.generate(params.campaignId, params.sessionId, body);
        },
        { params: bookletGenerateParamSchema, body: generateBookletsBodySchema },
    )
    // ADMIN: สร้าง QR payload ใหม่เมื่อ key เปลี่ยน (qr_status = STALE)
    .use(requireAdmin())
    .post(
        "/campaigns/:campaignId/sessions/:sessionId/booklets/regenerate",
        ({ params, set }) => {
            set.status = 200;
            return bookletService.regenerateSessionBooklets(params.campaignId, params.sessionId);
        },
        { params: bookletGenerateParamSchema },
    )
    .patch(
        "/booklets/:bookletId",
        ({ params, body, set }) => {
            set.status = 200;
            return bookletService.update(params.bookletId, body);
        },
        { params: bookletIdParamSchema, body: updateBookletBodySchema },
    )
    .delete(
        "/booklets/:bookletId",
        ({ params, set }) => {
            set.status = 200;
            return bookletService.delete(params.bookletId);
        },
        { params: bookletIdParamSchema },
    );
