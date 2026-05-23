import { AppError } from "../../cores/errors";
import { prisma } from "../../cores/prisma";
import { seatRepo } from "./seat.repo";
import { arrangeSeatForUsers, rowsToLayout, buildGridFromSeated } from "./seat.algorithm";
import type { SeatAssignBody } from "./seat.type";
import type { SessionData } from "../auth/auth.type";

// ── Shared helpers ────────────────────────────────────────────────────────────

async function validateCampaign(campaignId: number) {
    const campaign = await prisma.exam_campaigns.findFirst({
        where: { id: campaignId, deleted_at: null },
    });
    if (!campaign) throw new AppError("ไม่พบรอบสอบ", 404);
    return campaign;
}

async function validateRoom(campaignId: number, roomCode: string) {
    const room = await seatRepo.findRoomByCode(campaignId, roomCode);
    if (!room) throw new AppError("ไม่พบห้องสอบในรอบสอบนี้", 404);
    return room;
}

function getSeatPerRow(room: { seat_per_row: number | null; room_code: string }): number {
    if (!room.seat_per_row) {
        throw new AppError(`ห้อง ${room.room_code} ยังไม่ได้กำหนด seat_per_row — กรุณาอัปเดตข้อมูลห้องก่อน`, 400);
    }
    return room.seat_per_row;
}

function wrapPrismaUniqueError(e: unknown): never {
    const err = e as { code?: string };
    if (err?.code === "P2002") throw new AppError("ไม่สามารถจัดที่นั่งได้ เนื่องจากข้อมูลซ้ำ", 409);
    throw e;
}

// ── Service ───────────────────────────────────────────────────────────────────

export const seatService = {
    // 1. GET /campaigns/:campaignId/seats/status
    async getStatus(campaignId: number) {
        await validateCampaign(campaignId);
        const { total, assigned, totalRooms, assignedRooms } = await seatRepo.getSeatStatus(campaignId);
        return {
            success: true,
            data: {
                campaignId,
                totalCandidates:      total,
                assignedCandidates:   assigned,
                unassignedCandidates: total - assigned,
                totalRooms,
                assignedRooms,
                isAssigned: total > 0 && assigned === total,
            },
        };
    },

    // 2. GET /campaigns/:campaignId/rooms/:roomCode/seats
    async getLayout(campaignId: number, roomCode: string) {
        await validateCampaign(campaignId);
        const room = await validateRoom(campaignId, roomCode);
        const dbRows = await seatRepo.getSeatLayout(campaignId, roomCode);
        const { layout, seatsPerRow } = buildGridFromSeated(dbRows);
        return {
            success: true,
            data: {
                campaignId, roomCode,
                capacity:    room.capacity,
                seatPerRow:  room.seat_per_row,
                seatsPerRow,
                seats:       layout,
            },
        };
    },

    // 3. POST /campaigns/:campaignId/rooms/:roomCode/seats/preview
    async preview(campaignId: number, roomCode: string) {
        await validateCampaign(campaignId);
        const room = await validateRoom(campaignId, roomCode);
        const seatPerRow = getSeatPerRow(room);

        let candidates = await seatRepo.findCandidatesForRoom(campaignId, roomCode);
        if (candidates.length === 0) {
            candidates = (await seatRepo.findUnassignedCandidates(campaignId)).slice(0, room.capacity);
        }
        if (candidates.length === 0) throw new AppError("ยังไม่มีผู้เข้าสอบในรอบสอบนี้", 400);

        const { rows, conflictCount } = arrangeSeatForUsers(candidates, seatPerRow);
        return {
            success: true,
            data: {
                campaignId, roomCode,
                capacity:        room.capacity,
                seatPerRow,
                totalCandidates: candidates.length,
                conflictCount,
                seats:           rowsToLayout(rows),
            },
        };
    },

    // 4. POST /campaigns/:campaignId/rooms/:roomCode/seats/commit
    async commit(campaignId: number, roomCode: string, body: SeatAssignBody, session: SessionData) {
        await validateCampaign(campaignId);
        const room = await validateRoom(campaignId, roomCode);
        const seatPerRow = getSeatPerRow(room);

        // ดึง candidates: ใช้คนที่อยู่ในห้องนี้แล้ว ถ้าไม่มีใช้คนที่ยังไม่ถูกจัด
        let candidates = await seatRepo.findCandidatesForRoom(campaignId, roomCode);
        if (candidates.length === 0) {
            candidates = (await seatRepo.findUnassignedCandidates(campaignId)).slice(0, room.capacity);
        }
        if (candidates.length === 0) throw new AppError("ยังไม่มีผู้เข้าสอบในรอบสอบนี้", 400);
        if (candidates.length > room.capacity) {
            throw new AppError(`จำนวนผู้เข้าสอบ (${candidates.length}) เกิน capacity ห้อง (${room.capacity})`, 400);
        }

        const { rows, conflictCount } = arrangeSeatForUsers(candidates, seatPerRow);
        const seats = rowsToLayout(rows);

        try {
            await prisma.$transaction(async (tx) => {
                if (body.clearExisting) {
                    await seatRepo.clearSeatsForRoom(tx, campaignId, roomCode);
                }
                await seatRepo.saveSeatAssignments(
                    tx, roomCode,
                    seats.map((s) => ({ userCampaignId: s.userCampaignId, rowNo: s.rowNo, colNo: s.colNo })),
                );
                await tx.activity_logs.create({
                    data: {
                        actor_type:  "account",
                        account_id:  session.account_id,
                        action:      "SEAT_ROOM_ASSIGN",
                        object_type: "exam_rooms",
                        details:     { campaignId, roomCode, seatPerRow, assignedCount: seats.length, conflictCount },
                    },
                });
            });
        } catch (e) { wrapPrismaUniqueError(e); }

        return {
            success: true,
            message: "จัดที่นั่งสำเร็จ",
            data: { campaignId, roomCode, seatPerRow, assignedCount: seats.length, conflictCount, seats },
        };
    },

    // 5. POST /campaigns/:campaignId/seats/auto-assign
    async autoAssign(campaignId: number, body: SeatAssignBody, session: SessionData) {
        await validateCampaign(campaignId);

        const rooms = await seatRepo.findRoomsByCampaign(campaignId);
        if (rooms.length === 0) throw new AppError("ไม่พบห้องสอบในรอบสอบนี้", 404);

        // ตรวจว่าทุกห้องมี seat_per_row ก่อน assign
        const missingConfig = rooms.filter((r) => !r.seat_per_row).map((r) => r.room_code);
        if (missingConfig.length > 0) {
            throw new AppError(`ห้องต่อไปนี้ยังไม่ได้กำหนด seat_per_row: ${missingConfig.join(", ")}`, 400);
        }

        const candidates = await seatRepo.findCandidatesByCampaign(campaignId);
        if (candidates.length === 0) throw new AppError("ยังไม่มีผู้เข้าสอบในรอบสอบนี้", 400);

        const totalCapacity = rooms.reduce((s, r) => s + r.capacity, 0);
        if (totalCapacity < candidates.length) {
            throw new AppError("จำนวนที่นั่งรวมของห้องสอบไม่เพียงพอ", 400);
        }

        // กระจาย candidates ตาม capacity ของแต่ละห้อง แต่ละห้องใช้ seat_per_row ของตัวเอง
        let offset = 0;
        const roomBatches = rooms.map((room) => {
            const seatPerRow = room.seat_per_row!;
            const batch = candidates.slice(offset, offset + room.capacity);
            offset += batch.length;
            const { rows, conflictCount } = arrangeSeatForUsers(batch, seatPerRow);
            return { room, seatPerRow, conflictCount, seats: rowsToLayout(rows) };
        });

        try {
            await prisma.$transaction(async (tx) => {
                if (body.clearExisting) {
                    await seatRepo.clearSeatsForCampaign(tx, campaignId, false);
                }
                for (const { room, seats } of roomBatches) {
                    await seatRepo.saveSeatAssignments(
                        tx, room.room_code,
                        seats.map((s) => ({ userCampaignId: s.userCampaignId, rowNo: s.rowNo, colNo: s.colNo })),
                    );
                }
                await tx.activity_logs.create({
                    data: {
                        actor_type:  "account",
                        account_id:  session.account_id,
                        action:      "SEAT_AUTO_ASSIGN",
                        object_type: "exam_campaigns",
                        object_id:   campaignId,
                        details: {
                            campaignId,
                            totalCandidates: candidates.length,
                            rooms: roomBatches.map((b) => ({
                                roomCode:      b.room.room_code,
                                seatPerRow:    b.seatPerRow,
                                assignedCount: b.seats.length,
                                conflictCount: b.conflictCount,
                            })),
                        },
                    },
                });
            });
        } catch (e) { wrapPrismaUniqueError(e); }

        return {
            success: true,
            data: {
                campaignId,
                totalCandidates:    candidates.length,
                assignedCandidates: candidates.length,
                rooms: roomBatches.map(({ room, seatPerRow, seats, conflictCount }) => ({
                    roomCode:      room.room_code,
                    capacity:      room.capacity,
                    seatPerRow,
                    assignedCount: seats.length,
                    conflictCount,
                })),
            },
        };
    },

    // 6. DELETE /campaigns/:campaignId/seats
    async resetCampaign(campaignId: number, keepRoom: boolean, session: SessionData) {
        await validateCampaign(campaignId);
        await prisma.$transaction(async (tx) => {
            await seatRepo.clearSeatsForCampaign(tx, campaignId, keepRoom);
            await tx.activity_logs.create({
                data: {
                    actor_type:  "account",
                    account_id:  session.account_id,
                    action:      "SEAT_RESET",
                    object_type: "exam_campaigns",
                    object_id:   campaignId,
                    details:     { campaignId, keepRoom },
                },
            });
        });
        return { success: true, message: "ล้างการจัดที่นั่งสำเร็จ" };
    },

    // 7. DELETE /campaigns/:campaignId/rooms/:roomCode/seats
    async resetRoom(campaignId: number, roomCode: string, session: SessionData) {
        await validateCampaign(campaignId);
        await validateRoom(campaignId, roomCode);
        await prisma.$transaction(async (tx) => {
            await seatRepo.clearSeatsForRoom(tx, campaignId, roomCode);
            await tx.activity_logs.create({
                data: {
                    actor_type:  "account",
                    account_id:  session.account_id,
                    action:      "SEAT_RESET",
                    object_type: "exam_rooms",
                    details:     { campaignId, roomCode },
                },
            });
        });
        return { success: true, message: "ล้างการจัดที่นั่งของห้องสำเร็จ" };
    },
};
