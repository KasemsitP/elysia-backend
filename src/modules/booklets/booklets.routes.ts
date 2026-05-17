import { Elysia } from "elysia";
import { bookletService } from "./booklets.service";
import { requireSession } from "../../cores/session";
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
        "/campaigns/:campaignId/sessions/:sessionId/booklets/generate",
        ({ params, body, set }) => {
            set.status = 201;
            return bookletService.generate(params.campaignId, params.sessionId, body);
        },
        { params: bookletGenerateParamSchema, body: generateBookletsBodySchema },
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
