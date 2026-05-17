import { AppError } from "../../cores/errors";
import { prisma } from "../../cores/prisma";
import type { CreateNotificationBody, NotificationQuery } from "./notifications.type";
import type { SessionData } from "../auth/auth.type";

export const notificationService = {
    // Admin/Manager ดู notification ทั้งหมด
    async findAll(query: NotificationQuery) {
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        const skip = (page - 1) * limit;

        const data = await prisma.notification_messages.findMany({
            where: {
                deleted_at: null,
                ...(query.campaign_id !== undefined && { campaign_id: query.campaign_id }),
                ...(query.status !== undefined && { status: query.status }),
            },
            include: { notification_recipients: { select: { id: true, account_id: true, delivery_status: true } } },
            orderBy: { created_at: "desc" },
            skip,
            take: limit,
        });

        const total = await prisma.notification_messages.count({
            where: {
                deleted_at: null,
                ...(query.campaign_id !== undefined && { campaign_id: query.campaign_id }),
                ...(query.status !== undefined && { status: query.status }),
            },
        });

        return { success: true, message: "ดึง notification สำเร็จ", data, meta: { total, page, limit } };
    },

    // User ดู notification ของตัวเอง
    async findMine(session: SessionData) {
        const recipients = await prisma.notification_recipients.findMany({
            where: { account_id: session.account_id, deleted_at: null },
            include: {
                notification_messages: {
                    select: {
                        id: true,
                        type: true,
                        channel: true,
                        title: true,
                        body: true,
                        status: true,
                        created_at: true,
                    },
                },
            },
            orderBy: { created_at: "desc" },
            take: 50,
        });

        const data = recipients.map((r) => ({
            recipient_id: r.id,
            notification: r.notification_messages,
            read_at: r.read_at,
            dismissed_at: r.dismissed_at,
            delivery_status: r.delivery_status,
        }));

        return { success: true, message: "ดึง notification สำเร็จ", data };
    },

    // สร้าง notification และส่งให้ recipients
    async create(input: CreateNotificationBody, session: SessionData) {
        const notification = await prisma.$transaction(async (tx) => {
            const msg = await tx.notification_messages.create({
                data: {
                    campaign_id: input.campaign_id ?? null,
                    session_id: input.session_id ?? null,
                    type: input.type,
                    channel: input.channel,
                    title: input.title ?? null,
                    body: input.body,
                    status: "PENDING",
                    created_by: session.account_id,
                    scheduled_at: input.scheduled_at ? new Date(input.scheduled_at) : null,
                },
            });

            if (input.recipient_account_ids && input.recipient_account_ids.length > 0) {
                // ดึง account info สำหรับ target
                const accounts = await tx.accounts.findMany({
                    where: { id: { in: input.recipient_account_ids }, deleted_at: null },
                    select: { id: true, email: true },
                });

                await tx.notification_recipients.createMany({
                    data: accounts.map((a) => ({
                        notification_id: msg.id,
                        account_id: a.id,
                        recipient_type: "ACCOUNT",
                        recipient_target: a.email ?? String(a.id),
                        delivery_status: "PENDING",
                    })),
                });

                // เขียน outbox event สำหรับส่ง notification จริง
                await tx.service_outbox_events.create({
                    data: {
                        event_type: "NOTIFICATION_SEND",
                        aggregate_type: "notification_messages",
                        aggregate_id: msg.id,
                        payload: { notification_id: msg.id, channel: input.channel, type: input.type },
                    },
                });
            }

            return msg;
        });

        return { success: true, message: "สร้าง notification สำเร็จ", data: notification };
    },

    // Mark อ่านแล้ว
    async markRead(notificationId: number, session: SessionData) {
        const recipient = await prisma.notification_recipients.findFirst({
            where: { notification_id: notificationId, account_id: session.account_id },
        });
        if (!recipient) throw new AppError("ไม่พบ notification นี้", 404);

        const data = await prisma.notification_recipients.update({
            where: { id: recipient.id },
            data: { read_at: new Date() },
        });
        return { success: true, message: "ทำเครื่องหมายอ่านแล้ว", data };
    },

    // Dismiss (ซ่อน)
    async dismiss(notificationId: number, session: SessionData) {
        const recipient = await prisma.notification_recipients.findFirst({
            where: { notification_id: notificationId, account_id: session.account_id },
        });
        if (!recipient) throw new AppError("ไม่พบ notification นี้", 404);

        const data = await prisma.notification_recipients.update({
            where: { id: recipient.id },
            data: { dismissed_at: new Date() },
        });
        return { success: true, message: "ซ่อน notification แล้ว", data };
    },
};
