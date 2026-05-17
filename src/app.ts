import { Elysia } from "elysia"
import { openapi } from '@elysia/openapi'
import { errorHandler } from "./cores/error-handler";
import { authRoutes } from "./modules/auth/auth.routes";
import { campaignRoutes } from "./modules/campaign/campaign.routes";
import { sessionRoutes } from "./modules/session/session.routes";
import { subjectRoutes} from "./modules/subject/subject.routes";
import { cors } from '@elysia/cors'
import { logger } from '@grotto/logysia';

export const app = new Elysia({ prefix: "/api" })
    .use(openapi())
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
    .use(sessionRoutes)
    .use(subjectRoutes)

export type App = typeof app;