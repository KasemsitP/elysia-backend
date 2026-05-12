import { Elysia } from "elysia"
import { errorHandler } from "./cores/error-handler";
import { authRoutes } from "./modules/auth/auth.routes";
import { campaignRoutes } from "./modules/campaign/campaign.routes";
import { cors } from '@elysia/cors'
import { logger } from '@grotto/logysia';

export const app = new Elysia({ prefix: "/api" })
    .use(logger())
    .use(cors())
    .use(errorHandler)
    .get("/", () => {
        return {
            message: "Elysia is running"
        };
    })
    .use(authRoutes)
    .use(campaignRoutes)
