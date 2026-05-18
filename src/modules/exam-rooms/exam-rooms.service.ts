import { AppError } from "../../cores/errors";
import { prisma } from "../../cores/prisma";
import { campaignRepo } from "../campaign/campaign.repo";

export const examRoomService = {
    async findByCampaign(campaignId: number) {
        const campaign = await campaignRepo.findById(campaignId);
        if (!campaign) throw new AppError("ไม่พบรอบสอบ", 404);
        const data = await prisma.exam_rooms.findMany({
            where: { campaign_id: campaignId, deleted_at: null },
            orderBy: { room_code: "asc" },
        });
        return { success: true, message: "ดึงข้อมูลห้องสอบสำเร็จ", data };
    },

    async create(campaignId: number, input: { room_code: string; capacity: number }) {
        const campaign = await campaignRepo.findById(campaignId);
        if (!campaign) throw new AppError("ไม่พบรอบสอบ", 404);

        const existing = await prisma.exam_rooms.findFirst({
            where: { campaign_id: campaignId, room_code: input.room_code, deleted_at: null },
        });
        if (existing) throw new AppError(`ห้อง ${input.room_code} มีอยู่แล้วในรอบสอบนี้`, 409);

        const data = await prisma.exam_rooms.create({
            data: { campaign_id: campaignId, room_code: input.room_code, capacity: input.capacity },
        });
        return { success: true, message: "สร้างห้องสอบสำเร็จ", data };
    },

    async update(campaignId: number, roomCode: string, input: { capacity: number }) {
        const room = await prisma.exam_rooms.findFirst({
            where: { campaign_id: campaignId, room_code: roomCode, deleted_at: null },
        });
        if (!room) throw new AppError("ไม่พบห้องสอบ", 404);
        const data = await prisma.exam_rooms.update({
            where: { campaign_id_room_code: { campaign_id: campaignId, room_code: roomCode } },
            data: { capacity: input.capacity },
        });
        return { success: true, message: "อัปเดตห้องสอบสำเร็จ", data };
    },

    async delete(campaignId: number, roomCode: string) {
        const room = await prisma.exam_rooms.findFirst({
            where: { campaign_id: campaignId, room_code: roomCode, deleted_at: null },
        });
        if (!room) throw new AppError("ไม่พบห้องสอบ", 404);

        // ตรวจว่ามีผู้สอบในห้องนี้ไหม
        const occupied = await prisma.user_campaigns.count({
            where: { campaign_id: campaignId, room_code: roomCode, deleted_at: null },
        });
        if (occupied > 0) throw new AppError("ห้องนี้มีผู้สอบอยู่ ไม่สามารถลบได้", 400);

        await prisma.exam_rooms.update({
            where: { campaign_id_room_code: { campaign_id: campaignId, room_code: roomCode } },
            data: { deleted_at: new Date() },
        });
        return { success: true, message: "ลบห้องสอบสำเร็จ" };
    },
};
