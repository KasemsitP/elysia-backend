import { Elysia } from "elysia"
import { errorHandler } from "./cores/error-handler";
import { authRoutes } from "./modules/auth/auth.routes";
import { cors } from '@elysia/cors'

export const app = new Elysia()
    .use(cors())
    .use(errorHandler)
    .get("/", () => {
        return {
            message: "Elysia is running"
        };
    })
    .use(authRoutes)
