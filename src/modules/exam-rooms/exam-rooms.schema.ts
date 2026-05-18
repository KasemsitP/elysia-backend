import { t } from "elysia";

export const roomCampaignParamSchema = t.Object({
    campaignId: t.Numeric(),
});

export const roomParamSchema = t.Object({
    campaignId: t.Numeric(),
    roomCode: t.String(),
});

export const createRoomBodySchema = t.Object({
    room_code: t.String(),
    capacity: t.Number({ minimum: 1 }),
});

export const updateRoomBodySchema = t.Object({
    capacity: t.Number({ minimum: 1 }),
});
