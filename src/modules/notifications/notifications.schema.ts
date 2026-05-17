import { t } from "elysia";

export const notificationIdParamSchema = t.Object({
    notificationId: t.Numeric(),
});

export const notificationQuerySchema = t.Object({
    campaign_id: t.Optional(t.Numeric()),
    status: t.Optional(t.String()),
    page: t.Optional(t.Numeric()),
    limit: t.Optional(t.Numeric()),
});

export const createNotificationBodySchema = t.Object({
    campaign_id: t.Optional(t.Nullable(t.Number())),
    session_id: t.Optional(t.Nullable(t.Number())),
    type: t.String(),
    channel: t.Union([t.Literal("IN_APP"), t.Literal("EMAIL"), t.Literal("SMS")]),
    title: t.Optional(t.Nullable(t.String())),
    body: t.String(),
    // recipient account ids
    recipient_account_ids: t.Optional(t.Array(t.Number())),
    scheduled_at: t.Optional(t.Nullable(t.String())),
});
