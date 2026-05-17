import { t } from "elysia";

export const otpRequestBodySchema = t.Object({
    account_id: t.Number(),
    campaign_id: t.Optional(t.Nullable(t.Number())),
    purpose: t.String(), // เช่น "UNLOCK_CAMPAIGN", "RESET_PASSWORD"
    channel: t.Optional(t.Union([t.Literal("EMAIL"), t.Literal("SMS")])),
    // target = email หรือ phone ที่จะส่งไป (optional ถ้า lookup จาก account)
    target: t.Optional(t.Nullable(t.String())),
});

export const otpVerifyBodySchema = t.Object({
    otp_token: t.String(),   // token ที่ได้จาก request
    otp_code: t.String(),    // รหัส OTP 6 หลักที่ได้รับ
});

export const otpResendBodySchema = t.Object({
    otp_token: t.String(),
});

export const otpCancelBodySchema = t.Object({
    otp_token: t.String(),
});

// Unlock campaign — ต้องมี 2 managers verify แล้วถึงจะ unlock
export const unlockRequestBodySchema = t.Object({
    account_id: t.Number(),
});

export const unlockConfirmBodySchema = t.Object({
    otp_token: t.String(),
    otp_code: t.String(),
});

export const campaignUnlockParamSchema = t.Object({
    campaignId: t.Numeric(),
});
