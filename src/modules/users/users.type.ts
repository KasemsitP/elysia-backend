import type { Static } from "elysia";
import type {
    userIdParamSchema,
    userQuerySchema,
    createUserBodySchema,
    updateUserBodySchema,
    importUsersBodySchema,
} from "./users.schema";

export type UserIdParam = Static<typeof userIdParamSchema>;
export type UserQuery = Static<typeof userQuerySchema>;
export type CreateUserBody = Static<typeof createUserBodySchema>;
export type UpdateUserBody = Static<typeof updateUserBodySchema>;
export type ImportUsersBody = Static<typeof importUsersBodySchema>;
