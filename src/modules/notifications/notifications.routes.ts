import { Elysia } from "elysia";
import { notificationService } from "./notifications.service";
import { requireSession } from "../../cores/session";
import {
    notificationIdParamSchema,
    notificationQuerySchema,
    createNotificationBodySchema,
} from "./notifications.schema";

export const notificationRoutes = new Elysia({ prefix: "/notifications" })
    .use(requireSession)
    .get(
        "/",
        ({ query, set }) => {
            set.status = 200;
            return notificationService.findAll(query);
        },
        { query: notificationQuerySchema },
    )
    .get(
        "/me",
        ({ session, set }) => {
            set.status = 200;
            return notificationService.findMine(session);
        },
    )
    .post(
        "/",
        ({ body, session, set }) => {
            set.status = 201;
            return notificationService.create(body, session);
        },
        { body: createNotificationBodySchema },
    )
    .post(
        "/:notificationId/read",
        ({ params, session, set }) => {
            set.status = 200;
            return notificationService.markRead(params.notificationId, session);
        },
        { params: notificationIdParamSchema },
    )
    .post(
        "/:notificationId/dismiss",
        ({ params, session, set }) => {
            set.status = 200;
            return notificationService.dismiss(params.notificationId, session);
        },
        { params: notificationIdParamSchema },
    );
