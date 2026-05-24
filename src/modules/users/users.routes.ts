import { Elysia } from "elysia";
import { userService } from "./users.service";
import { requireSession } from "../../cores/session";
import {
    userIdParamSchema,
    userQuerySchema,
    createUserBodySchema,
    updateUserBodySchema,
    importUsersSeqBodySchema,
} from "./users.schema";

export const userRoutes = new Elysia({ prefix: "/users" })
    .use(requireSession)
    .get(
        "/",
        ({ query, set }) => {
            set.status = 200;
            return userService.findAll(query);
        },
        { query: userQuerySchema },
    )
    .get(
        "/:userId",
        ({ params, set }) => {
            set.status = 200;
            return userService.findById(params.userId);
        },
        { params: userIdParamSchema },
    )
    .post(
        "/",
        ({ body, set }) => {
            set.status = 201;
            return userService.create(body);
        },
        { body: createUserBodySchema },
    )
    .post(
        "/import",
        ({ body, set }) => {
            set.status = 201;
            return userService.importSequential(body);
        },
        { body: importUsersSeqBodySchema },
    )
    .patch(
        "/:userId",
        ({ params, body, set }) => {
            set.status = 200;
            return userService.update(params.userId, body);
        },
        { params: userIdParamSchema, body: updateUserBodySchema },
    )
    .delete(
        "/:userId",
        ({ params, set }) => {
            set.status = 200;
            return userService.delete(params.userId);
        },
        { params: userIdParamSchema },
    );
