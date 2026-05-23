import { prisma, type Tx } from "../../cores/prisma";
import type { SeatUser } from "./seat.type";

type UcWithUser = {
    id: number;
    users: {
        id: number;
        user_code: string;
        title: string | null;
        full_name: string;
        first_name: string | null;
        last_name: string | null;
        deleted_at: Date | null;
    } | null;
};

function toSeatUser(uc: UcWithUser): SeatUser | null {
    if (!uc.users || uc.users.deleted_at) return null;
    return {
        userCampaignId: uc.id,
        userId:         uc.users.id,
        userCode:       uc.users.user_code,
        title:          uc.users.title,
        fullName:       uc.users.full_name,
        firstName:      uc.users.first_name,
        lastName:       uc.users.last_name,
    };
}

const candidateOrderBy = [
    { users: { last_name: "asc" as const } },
    { users: { first_name: "asc" as const } },
    { users: { user_code: "asc" as const } },
];

export const seatRepo = {
    async findRoomsByCampaign(campaignId: number) {
        return prisma.exam_rooms.findMany({
            where: { campaign_id: campaignId, deleted_at: null },
            orderBy: { room_code: "asc" },
        });
    },

    async findRoomByCode(campaignId: number, roomCode: string) {
        return prisma.exam_rooms.findFirst({
            where: { campaign_id: campaignId, room_code: roomCode, deleted_at: null },
        });
    },

    async findCandidatesByCampaign(campaignId: number): Promise<SeatUser[]> {
        const rows = await prisma.user_campaigns.findMany({
            where: { campaign_id: campaignId, deleted_at: null },
            include: { users: true },
            orderBy: candidateOrderBy,
        });
        return rows.map(toSeatUser).filter((u): u is SeatUser => u !== null);
    },

    async findCandidatesForRoom(campaignId: number, roomCode: string): Promise<SeatUser[]> {
        const rows = await prisma.user_campaigns.findMany({
            where: { campaign_id: campaignId, room_code: roomCode, deleted_at: null },
            include: { users: true },
            orderBy: candidateOrderBy,
        });
        return rows.map(toSeatUser).filter((u): u is SeatUser => u !== null);
    },

    async findUnassignedCandidates(campaignId: number): Promise<SeatUser[]> {
        const rows = await prisma.user_campaigns.findMany({
            where: { campaign_id: campaignId, deleted_at: null, room_code: null },
            include: { users: true },
            orderBy: candidateOrderBy,
        });
        return rows.map(toSeatUser).filter((u): u is SeatUser => u !== null);
    },

    async clearSeatsForCampaign(tx: Tx, campaignId: number, keepRoom = false) {
        return tx.user_campaigns.updateMany({
            where: { campaign_id: campaignId, deleted_at: null },
            data: {
                ...(!keepRoom && { room_code: null }),
                row_no: null,
                col_no: null,
            },
        });
    },

    async clearSeatsForRoom(tx: Tx, campaignId: number, roomCode: string) {
        return tx.user_campaigns.updateMany({
            where: { campaign_id: campaignId, room_code: roomCode, deleted_at: null },
            data: { row_no: null, col_no: null },
        });
    },

    async saveSeatAssignments(
        tx: Tx,
        roomCode: string,
        assignments: Array<{ userCampaignId: number; rowNo: number; colNo: number }>,
    ) {
        for (const a of assignments) {
            await tx.user_campaigns.update({
                where: { id: a.userCampaignId },
                data: { room_code: roomCode, row_no: a.rowNo, col_no: a.colNo },
            });
        }
    },

    async getSeatLayout(campaignId: number, roomCode: string) {
        return prisma.user_campaigns.findMany({
            where: {
                campaign_id: campaignId,
                room_code:   roomCode,
                row_no:      { not: null },
                col_no:      { not: null },
                deleted_at:  null,
            },
            include: { users: true },
            orderBy: [{ row_no: "asc" }, { col_no: "asc" }],
        });
    },

    async getSeatStatus(campaignId: number) {
        const [total, assigned, totalRooms, assignedRoomGroups] = await Promise.all([
            prisma.user_campaigns.count({
                where: { campaign_id: campaignId, deleted_at: null },
            }),
            prisma.user_campaigns.count({
                where: {
                    campaign_id: campaignId,
                    deleted_at:  null,
                    room_code:   { not: null },
                    row_no:      { not: null },
                    col_no:      { not: null },
                },
            }),
            prisma.exam_rooms.count({
                where: { campaign_id: campaignId, deleted_at: null },
            }),
            prisma.user_campaigns.groupBy({
                by: ["room_code"],
                where: {
                    campaign_id: campaignId,
                    deleted_at:  null,
                    room_code:   { not: null },
                    row_no:      { not: null },
                    col_no:      { not: null },
                },
            }),
        ]);
        return { total, assigned, totalRooms, assignedRooms: assignedRoomGroups.length };
    },
};
