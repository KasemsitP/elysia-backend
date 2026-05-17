import type { Static } from "elysia";
import type {
    notificationIdParamSchema,
    notificationQuerySchema,
    createNotificationBodySchema,
} from "./notifications.schema";

export type NotificationIdParam = Static<typeof notificationIdParamSchema>;
export type NotificationQuery = Static<typeof notificationQuerySchema>;
export type CreateNotificationBody = Static<typeof createNotificationBodySchema>;
