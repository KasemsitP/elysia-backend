import { Elysia } from "elysia";
import { requireSession } from "../../cores/session";
import { requireNonGrader } from "../../cores/auth-guard";
import { signsheetService } from "./signsheet.service";
import { signsheetParamSchema, signsheetQuerySchema } from "./signsheet.schema";

export const signsheetRoutes = new Elysia({ prefix: "/signsheet" })
    .use(requireSession)
    .use(requireNonGrader())
    // ดูรายชื่อผู้เข้าสอบ + signsheet_status ของ session
    .get(
        "/campaign/:campaignId/session/:sessionId",
        ({ params, query, set }) => {
            set.status = 200;
            return signsheetService.getSignsheet(params.campaignId, params.sessionId, query);
        },
        { params: signsheetParamSchema, query: signsheetQuerySchema },
    )
    // สถานะ PDF: NOT_GENERATED / READY / STALE
    .get(
        "/campaign/:campaignId/session/:sessionId/pdf/status",
        ({ params, set }) => {
            set.status = 200;
            return signsheetService.getSignsheetPdfStatus(params.campaignId, params.sessionId);
        },
        { params: signsheetParamSchema },
    )
    // ดาวน์โหลด PDF ที่บันทึกไว้ — ไม่มี decrypt ไม่ใช้ key
    .get(
        "/campaign/:campaignId/session/:sessionId/pdf",
        async ({ params, set }) => {
            const filePath = await signsheetService.getStoredSignsheetPdfPath(
                params.campaignId,
                params.sessionId,
            );
            set.status  = 200;
            set.headers["Content-Type"]        = "application/pdf";
            set.headers["Content-Disposition"] = `attachment; filename="signsheet_${params.campaignId}_${params.sessionId}.pdf"`;
            return Bun.file(filePath);
        },
        { params: signsheetParamSchema },
    );
