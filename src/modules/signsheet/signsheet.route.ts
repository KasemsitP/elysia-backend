import { Elysia } from "elysia";
import { requireSession } from "../../cores/session";
import { requireNonGrader } from "../../cores/auth-guard";
import { signsheetService } from "./signsheet.service";
import { signsheetParamSchema, signsheetQuerySchema, signsheetPdfQuerySchema } from "./signsheet.schema";

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
    )
    .get(
        "/campaign/:campaignId/session/:sessionId/pdf",
        async ({ params, query, set }) => {
            const result = await signsheetService.generateSignsheetPdf({
                campaignId: params.campaignId,
                sessionId:  params.sessionId,
                search:     query.search?.trim() ?? "",
            });
            set.status  = 200;
            set.headers["Content-Type"]        = "application/pdf";
            set.headers["Content-Disposition"] = `attachment; filename="${result.fileName}"`;
            return Bun.file(result.filePath);
        },
        { params: signsheetParamSchema, query: signsheetPdfQuerySchema },
    );
