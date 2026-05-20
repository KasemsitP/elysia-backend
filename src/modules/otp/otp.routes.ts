import { Elysia } from "elysia";
import { otpService } from "./otp.service";
import { requireSession } from "../../cores/session";
import { requireAdminOrManager } from "../../cores/auth-guard";
import { otpRequestRateLimitHandler, otpVerifyRateLimitHandler } from "../../cores/rate-limit";
import {
    otpRequestBodySchema,
    otpVerifyBodySchema,
    otpResendBodySchema,
    otpCancelBodySchema,
    unlockRequestBodySchema,
    unlockConfirmBodySchema,
    campaignUnlockParamSchema,
} from "./otp.schema";

export const otpRoutes = new Elysia()
    .use(requireSession)
    // ── OTP (rate-limited) ───────────────────────────────────────────────────
    .post("/otp/request", ({ body, set }) => { set.status = 201; return otpService.request(body); }, { body: otpRequestBodySchema, beforeHandle: otpRequestRateLimitHandler })
    .post("/otp/verify",  ({ body, set }) => { set.status = 200; return otpService.verify(body); },  { body: otpVerifyBodySchema,  beforeHandle: otpVerifyRateLimitHandler  })
    .post("/otp/resend",  ({ body, set }) => { set.status = 200; return otpService.resend(body); },  { body: otpResendBodySchema })
    .post("/otp/cancel",  ({ body, set }) => { set.status = 200; return otpService.cancel(body); },  { body: otpCancelBodySchema })
    // ── Campaign Unlock (MANAGER only) ───────────────────────────────────────
    .use(requireAdminOrManager())
    .post(
        "/campaigns/:campaignId/unlock/request",
        ({ params, body, set }) => { set.status = 201; return otpService.requestUnlock(params.campaignId, body.account_id); },
        { params: campaignUnlockParamSchema, body: unlockRequestBodySchema },
    )
    .post(
        "/campaigns/:campaignId/unlock/confirm",
        ({ params, body, set }) => { set.status = 200; return otpService.confirmUnlock(params.campaignId, body); },
        { params: campaignUnlockParamSchema, body: unlockConfirmBodySchema },
    )
    .get(
        "/campaigns/:campaignId/is-unlock",
        async ({ params, set }) => {
            const { prisma } = await import("../../cores/prisma");
            const campaign = await prisma.exam_campaigns.findFirst({ where: { id: params.campaignId } });
            set.status = 200;
            return { success: true, message: "สำเร็จ", data: { is_unlock: campaign?.is_unlock ?? false } };
        },
        { params: campaignUnlockParamSchema },
    );
