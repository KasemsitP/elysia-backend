import type { Static } from "elysia";
import type {
    otpRequestBodySchema,
    otpVerifyBodySchema,
    otpResendBodySchema,
    otpCancelBodySchema,
    unlockRequestBodySchema,
    unlockConfirmBodySchema,
    campaignUnlockParamSchema,
} from "./otp.schema";

export type OtpRequestBody = Static<typeof otpRequestBodySchema>;
export type OtpVerifyBody = Static<typeof otpVerifyBodySchema>;
export type OtpResendBody = Static<typeof otpResendBodySchema>;
export type OtpCancelBody = Static<typeof otpCancelBodySchema>;
export type UnlockRequestBody = Static<typeof unlockRequestBodySchema>;
export type UnlockConfirmBody = Static<typeof unlockConfirmBodySchema>;
export type CampaignUnlockParam = Static<typeof campaignUnlockParamSchema>;
