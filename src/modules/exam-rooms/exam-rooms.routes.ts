import { Elysia } from "elysia";
import { examRoomService } from "./exam-rooms.service";
import { requireSession } from "../../cores/session";
import {
    roomCampaignParamSchema,
    roomParamSchema,
    createRoomBodySchema,
    updateRoomBodySchema,
} from "./exam-rooms.schema";

export const examRoomRoutes = new Elysia({ prefix: "/campaigns/:campaignId/rooms" })
    .use(requireSession)
    .get(
        "/",
        ({ params, set }) => {
            set.status = 200;
            return examRoomService.findByCampaign(params.campaignId);
        },
        { params: roomCampaignParamSchema },
    )
    .post(
        "/",
        ({ params, body, set }) => {
            set.status = 201;
            return examRoomService.create(params.campaignId, body);
        },
        { params: roomCampaignParamSchema, body: createRoomBodySchema },
    )
    .patch(
        "/:roomCode",
        ({ params, body, set }) => {
            set.status = 200;
            return examRoomService.update(params.campaignId, params.roomCode, body);
        },
        { params: roomParamSchema, body: updateRoomBodySchema },
    )
    .delete(
        "/:roomCode",
        ({ params, set }) => {
            set.status = 200;
            return examRoomService.delete(params.campaignId, params.roomCode);
        },
        { params: roomParamSchema },
    );
