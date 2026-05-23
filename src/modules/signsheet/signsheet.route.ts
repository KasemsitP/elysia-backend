import { Elysia } from "elysia";
import { requireSession } from "../../cores/session";
import { requireNonGrader } from "../../cores/auth-guard";
import { signsheetService } from "./signsheet.service";
import { signsheetParamSchema, signsheetQuerySchema } from "./signsheet.schema";

export const signsheetRoutes = new Elysia({ prefix: "/signsheet" })
    .use(requireSession)
    .use(requireNonGrader())
    .get(
        "/campaign/:campaignId/session/:sessionId",
        ({ params, query, set }) => {
            set.status = 200;
            return signsheetService.getSignsheet(params.campaignId, params.sessionId, query);
        },
        { params: signsheetParamSchema, query: signsheetQuerySchema },
    );
