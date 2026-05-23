import { t } from "elysia";

export const roomCampaignParamSchema = t.Object({
    campaignId: t.Numeric(),
});

export const roomParamSchema = t.Object({
    campaignId: t.Numeric(),
    roomCode: t.String(),
});

export const createRoomBodySchema = t.Object({
    room_code: t.String({ minLength: 1 }),
    capacity: t.Number({ minimum: 1 }),
    seat_per_row: t.Optional(t.Number({ minimum: 1, maximum: 100 })),
});

export const updateRoomBodySchema = t.Object({
    capacity: t.Optional(t.Number({ minimum: 1 })),
    seat_per_row: t.Optional(t.Number({ minimum: 1, maximum: 100 })),
});
