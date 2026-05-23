import type { Static } from "elysia";
import type {
    seatCampaignParamSchema,
    seatRoomParamSchema,
    seatAssignBodySchema,
    seatResetQuerySchema,
} from "./seat.schema";

export type SeatCampaignParam = Static<typeof seatCampaignParamSchema>;
export type SeatRoomParam     = Static<typeof seatRoomParamSchema>;
export type SeatAssignBody    = Static<typeof seatAssignBodySchema>;
export type SeatResetQuery    = Static<typeof seatResetQuerySchema>;

export type SeatUser = {
    userCampaignId: number;
    userId:         number;
    userCode:       string;
    title:          string | null;
    fullName:       string;
    firstName:      string | null;
    lastName:       string | null;
};

export type SeatPos = { r: number; c: number };

export type SeatLayoutItem = {
    rowIndex:       number;
    colIndex:       number;
    rowNo:          number;
    colNo:          number;
    userCampaignId: number;
    userId:         number;
    userCode:       string;
    title:          string | null;
    fullName:       string;
    firstName:      string | null;
    lastName:       string | null;
    hasConflict:    boolean;
};
