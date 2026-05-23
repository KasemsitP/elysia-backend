import { t } from "elysia";

export const seatCampaignParamSchema = t.Object({
    campaignId: t.Numeric(),
});

export const seatRoomParamSchema = t.Object({
    campaignId: t.Numeric(),
    roomCode:   t.String({ minLength: 1 }),
});

export const seatAssignBodySchema = t.Object({
    strategy:      t.Optional(t.Literal("AVOID_SAME_LASTNAME_ADJACENT")),
    clearExisting: t.Optional(t.Boolean()),
});

// keepRoom ส่งมาเป็น query string — เปรียบเทียบกับ "true" ในฝั่ง service
export const seatResetQuerySchema = t.Object({
    keepRoom: t.Optional(t.String()),
});
