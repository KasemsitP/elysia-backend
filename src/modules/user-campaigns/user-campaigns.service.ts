import { AppError } from "../../cores/errors";
import { prisma } from "../../cores/prisma";
import { campaignRepo } from "../campaign/campaign.repo";

export const userCampaignService = {
    // ── Candidates (user_campaigns) ──────────────────────────────────────────
    async findByCampaign(campaignId: number) {
        const campaign = await campaignRepo.findById(campaignId);
        if (!campaign) throw new AppError("ไม่พบรอบสอบ", 404);
        const data = await prisma.user_campaigns.findMany({
            where: { campaign_id: campaignId, deleted_at: null },
            include: { users: { select: { id: true, user_code: true, full_name: true, email: true } } },
            orderBy: { id: "asc" },
        });
        return { success: true, message: "ดึงรายชื่อผู้สอบสำเร็จ", data };
    },

    async addCandidate(
        campaignId: number,
        input: { user_id: number; room_code?: string | null; row_no?: number | null; col_no?: number | null },
    ) {
        const campaign = await campaignRepo.findById(campaignId);
        if (!campaign) throw new AppError("ไม่พบรอบสอบ", 404);

        const user = await prisma.users.findFirst({ where: { id: input.user_id, deleted_at: null } });
        if (!user) throw new AppError("ไม่พบผู้สอบ", 404);

        // Prevent duplicate in same campaign
        const dupUser = await prisma.user_campaigns.findFirst({
            where: { user_id: input.user_id, campaign_id: campaignId, deleted_at: null },
        });
        if (dupUser) throw new AppError("ผู้สอบนี้ลงทะเบียนในรอบสอบนี้แล้ว", 409);

        // Prevent duplicate seat (only when all seat fields provided)
        if (input.room_code && input.row_no != null && input.col_no != null) {
            const dupSeat = await prisma.user_campaigns.findFirst({
                where: {
                    campaign_id: campaignId,
                    room_code: input.room_code,
                    row_no: input.row_no,
                    col_no: input.col_no,
                    deleted_at: null,
                },
            });
            if (dupSeat) throw new AppError("ที่นั่งนี้ถูกจองแล้ว", 409);

            // Verify room exists
            const room = await prisma.exam_rooms.findFirst({
                where: { campaign_id: campaignId, room_code: input.room_code, deleted_at: null },
            });
            if (!room) throw new AppError(`ไม่พบห้อง ${input.room_code}`, 404);
        }

        const data = await prisma.user_campaigns.create({
            data: {
                user_id: input.user_id,
                campaign_id: campaignId,
                room_code: input.room_code ?? null,
                row_no: input.row_no ?? null,
                col_no: input.col_no ?? null,
            },
            include: { users: { select: { id: true, user_code: true, full_name: true } } },
        });
        return { success: true, message: "เพิ่มผู้สอบในรอบสอบสำเร็จ", data };
    },

    async updateSeat(
        campaignId: number,
        userCampaignId: number,
        input: { room_code?: string | null; row_no?: number | null; col_no?: number | null },
    ) {
        const uc = await prisma.user_campaigns.findFirst({
            where: { id: userCampaignId, campaign_id: campaignId, deleted_at: null },
        });
        if (!uc) throw new AppError("ไม่พบผู้สอบในรอบสอบนี้", 404);

        const newRoom = input.room_code !== undefined ? input.room_code : uc.room_code;
        const newRow = input.row_no !== undefined ? input.row_no : uc.row_no;
        const newCol = input.col_no !== undefined ? input.col_no : uc.col_no;

        // Check seat conflict (excluding self)
        if (newRoom && newRow != null && newCol != null) {
            const dup = await prisma.user_campaigns.findFirst({
                where: {
                    campaign_id: campaignId,
                    room_code: newRoom,
                    row_no: newRow,
                    col_no: newCol,
                    deleted_at: null,
                    id: { not: userCampaignId },
                },
            });
            if (dup) throw new AppError("ที่นั่งนี้ถูกจองแล้ว", 409);
        }

        const data = await prisma.user_campaigns.update({
            where: { id: userCampaignId },
            data: {
                ...(input.room_code !== undefined && { room_code: input.room_code }),
                ...(input.row_no !== undefined && { row_no: input.row_no }),
                ...(input.col_no !== undefined && { col_no: input.col_no }),
            },
            include: { users: { select: { id: true, user_code: true, full_name: true } } },
        });
        return { success: true, message: "อัปเดตที่นั่งสำเร็จ", data };
    },

    async removeCandidate(campaignId: number, userCampaignId: number) {
        const uc = await prisma.user_campaigns.findFirst({
            where: { id: userCampaignId, campaign_id: campaignId, deleted_at: null },
        });
        if (!uc) throw new AppError("ไม่พบผู้สอบในรอบสอบนี้", 404);

        await prisma.$transaction(async (tx) => {
            // ลบ user_sessions ที่ผูกกับ user_campaign นี้ด้วย
            await tx.user_sessions.updateMany({
                where: { user_campaign_id: userCampaignId, deleted_at: null },
                data: { deleted_at: new Date() },
            });
            await tx.user_campaigns.update({
                where: { id: userCampaignId },
                data: { deleted_at: new Date() },
            });
        });
        return { success: true, message: "ลบผู้สอบออกจากรอบสอบสำเร็จ" };
    },

    // ── Session Candidates (user_sessions) ───────────────────────────────────
    async findSessionCandidates(campaignId: number, sessionId: number) {
        // Validate session belongs to campaign
        const session = await prisma.sessions.findFirst({
            where: { id: sessionId, campaign_id: campaignId, deleted_at: null },
        });
        if (!session) throw new AppError("ไม่พบวันสอบ", 404);

        const data = await prisma.user_sessions.findMany({
            where: { session_id: sessionId, campaign_id: campaignId, deleted_at: null },
            include: {
                user_campaigns_user_sessions_user_campaign_id_campaign_idTouser_campaigns: {
                    include: { users: { select: { id: true, user_code: true, full_name: true } } },
                },
            },
            orderBy: { id: "asc" },
        });
        return { success: true, message: "ดึงรายชื่อผู้สอบในวันสอบสำเร็จ", data };
    },

    async addSessionCandidate(campaignId: number, sessionId: number, userCampaignId: number) {
        const session = await prisma.sessions.findFirst({
            where: { id: sessionId, campaign_id: campaignId, deleted_at: null },
        });
        if (!session) throw new AppError("ไม่พบวันสอบ", 404);

        const uc = await prisma.user_campaigns.findFirst({
            where: { id: userCampaignId, campaign_id: campaignId, deleted_at: null },
        });
        if (!uc) throw new AppError("ไม่พบผู้สอบในรอบสอบนี้ กรุณาเพิ่มเป็น candidate ก่อน", 404);

        const dup = await prisma.user_sessions.findFirst({
            where: { user_campaign_id: userCampaignId, session_id: sessionId, deleted_at: null },
        });
        if (dup) throw new AppError("ผู้สอบนี้ลงทะเบียนในวันสอบนี้แล้ว", 409);

        const data = await prisma.user_sessions.create({
            data: { user_campaign_id: userCampaignId, campaign_id: campaignId, session_id: sessionId },
        });
        return { success: true, message: "เพิ่มผู้สอบในวันสอบสำเร็จ", data };
    },

    async removeSessionCandidate(campaignId: number, sessionId: number, userSessionId: number) {
        const us = await prisma.user_sessions.findFirst({
            where: { id: userSessionId, session_id: sessionId, campaign_id: campaignId, deleted_at: null },
        });
        if (!us) throw new AppError("ไม่พบผู้สอบในวันสอบนี้", 404);
        await prisma.user_sessions.update({
            where: { id: userSessionId },
            data: { deleted_at: new Date() },
        });
        return { success: true, message: "ลบผู้สอบออกจากวันสอบสำเร็จ" };
    },
};
