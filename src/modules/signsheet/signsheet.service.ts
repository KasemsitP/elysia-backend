import { AppError } from "../../cores/errors";
import { prisma } from "../../cores/prisma";
import type { signsheetQuerySchema } from "./signsheet.schema";
import type { Static } from "elysia";

type SignsheetQuery = Static<typeof signsheetQuerySchema>;

export const signsheetService = {
    async getSignsheet(campaignId: number, sessionId: number, query: SignsheetQuery) {
        const page   = Math.max(1, Number(query.page  ?? 1));
        const limit  = Math.min(Math.max(1, Number(query.limit ?? 30)), 200);
        const search = (query.search ?? "").trim();

        const campaign = await prisma.exam_campaigns.findFirst({
            where:  { id: campaignId, deleted_at: null },
            select: { id: true, name: true, year_be: true, campaign_size: true, site: true, is_unlock: true },
        });
        if (!campaign) throw new AppError("ไม่พบรอบสอบ", 404);

        const session = await prisma.sessions.findFirst({
            where:  { id: sessionId, campaign_id: campaignId, deleted_at: null },
            select: { id: true, session_code: true, title: true, exam_date: true, day_no: true },
        });
        if (!session) throw new AppError("ไม่พบวันสอบในรอบสอบนี้", 404);

        const searchFilter = search
            ? {
                users: {
                    OR: [
                        { full_name:  { contains: search } },
                        { user_code:  { contains: search } },
                        { first_name: { contains: search } },
                        { last_name:  { contains: search } },
                    ],
                },
              }
            : {};

        const where = {
            campaign_id: campaignId,
            deleted_at:  null,
            user_sessions_user_sessions_user_campaign_id_campaign_idTouser_campaigns: {
                some: { session_id: sessionId, campaign_id: campaignId, deleted_at: null },
            },
            ...searchFilter,
        };

        const [total, uc] = await Promise.all([
            prisma.user_campaigns.count({ where }),
            prisma.user_campaigns.findMany({
                where,
                select: {
                    id:        true,
                    room_code: true,
                    row_no:    true,
                    col_no:    true,
                    users:     {
                        select: {
                            id:          true,
                            user_code:   true,
                            title:       true,
                            full_name:   true,
                            first_name:  true,
                            last_name:   true,
                            national_id: true,
                        },
                    },
                },
                orderBy: [
                    { room_code: "asc" },
                    { row_no:    "asc" },
                    { col_no:    "asc" },
                    { users:     { user_code: "asc" } },
                ],
                skip: (page - 1) * limit,
                take: limit,
            }),
        ]);

        const offset = (page - 1) * limit;

        return {
            success: true,
            data: {
                campaign: {
                    id:            campaign.id,
                    name:          campaign.name,
                    year_be:       campaign.year_be,
                    campaign_size: campaign.campaign_size,
                    site:          campaign.site,
                    is_unlock:     campaign.is_unlock,
                },
                session: {
                    id:           session.id,
                    session_code: session.session_code,
                    title:        session.title,
                    exam_date:    session.exam_date.toISOString().split("T")[0],
                    day_no:       session.day_no,
                },
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit),
                },
                rows: uc.map((row, idx) => ({
                    index:      offset + idx + 1,
                    userId:     row.users?.id     ?? null,
                    userCode:   row.users?.user_code  ?? null,
                    title:      row.users?.title      ?? null,
                    fullName:   row.users?.full_name  ?? null,
                    firstName:  row.users?.first_name ?? null,
                    lastName:   row.users?.last_name  ?? null,
                    nationalId: row.users?.national_id ?? null,
                    roomCode:   row.room_code,
                    rowNo:      row.row_no,
                    colNo:      row.col_no,
                    seatNo:     row.row_no != null && row.col_no != null
                        ? `${row.row_no}/${row.col_no}`
                        : null,
                })),
            },
        };
    },
};
