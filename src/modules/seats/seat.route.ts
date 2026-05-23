import { Elysia } from "elysia";
import { seatService } from "./seat.service";
import { requireSession } from "../../cores/session";
import { requireAdminOrStaff } from "../../cores/auth-guard";
import {
    seatCampaignParamSchema,
    seatRoomParamSchema,
    seatAssignBodySchema,
    seatResetQuerySchema,
} from "./seat.schema";

// Read — ADMIN + STAFF เท่านั้น (GRADER ถูก block โดย requireAdminOrStaff)
const readRoutes = new Elysia()
    .use(requireSession)
    .use(requireAdminOrStaff())
    .get(
        "/campaigns/:campaignId/seats/status",
        ({ params, set }) => { set.status = 200; return seatService.getStatus(params.campaignId); },
        { params: seatCampaignParamSchema },
    )
    .get(
        "/campaigns/:campaignId/rooms/:roomCode/seats",
        ({ params, set }) => { set.status = 200; return seatService.getLayout(params.campaignId, params.roomCode); },
        { params: seatRoomParamSchema },
    );

// Write — ADMIN + STAFF เท่านั้น
const writeRoutes = new Elysia()
    .use(requireSession)
    .use(requireAdminOrStaff())
    .post(
        "/campaigns/:campaignId/rooms/:roomCode/seats/preview",
        ({ params, set }) => {
            set.status = 200;
            return seatService.preview(params.campaignId, params.roomCode);
        },
        { params: seatRoomParamSchema },
    )
    .post(
        "/campaigns/:campaignId/rooms/:roomCode/seats/commit",
        ({ params, body, session, set }) => {
            set.status = 200;
            return seatService.commit(params.campaignId, params.roomCode, body, session);
        },
        { params: seatRoomParamSchema, body: seatAssignBodySchema },
    )
    .post(
        "/campaigns/:campaignId/seats/auto-assign",
        ({ params, body, session, set }) => {
            set.status = 200;
            return seatService.autoAssign(params.campaignId, body, session);
        },
        { params: seatCampaignParamSchema, body: seatAssignBodySchema },
    )
    .delete(
        "/campaigns/:campaignId/seats",
        ({ params, query, session, set }) => {
            set.status = 200;
            return seatService.resetCampaign(params.campaignId, query.keepRoom === "true", session);
        },
        { params: seatCampaignParamSchema, query: seatResetQuerySchema },
    )
    .delete(
        "/campaigns/:campaignId/rooms/:roomCode/seats",
        ({ params, session, set }) => {
            set.status = 200;
            return seatService.resetRoom(params.campaignId, params.roomCode, session);
        },
        { params: seatRoomParamSchema },
    );

export const seatRoutes = new Elysia().use(readRoutes).use(writeRoutes);
