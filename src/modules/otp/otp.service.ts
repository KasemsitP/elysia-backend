import { randomBytes, randomInt } from "crypto";
import { AppError } from "../../cores/errors";
import { prisma } from "../../cores/prisma";
import type { OtpRequestBody, OtpVerifyBody, OtpResendBody, OtpCancelBody } from "./otp.type";

const OTP_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;

// สร้าง OTP 6 หลัก
function generateOtp(): string {
    return String(randomInt(100000, 999999));
}

// สร้าง token สำหรับ identify session (client ใช้ระบุ session ไม่ใช่ id)
function generateToken(): string {
    return randomBytes(32).toString("hex");
}

async function createOtpSession(
    account_id: number,
    purpose: string,
    campaign_id: number | null,
    channel: string,
    target: string | null,
) {
    const otp = generateOtp();
    const token = generateToken();
    const otpHash = await Bun.password.hash(otp, { algorithm: "bcrypt", cost: 10 });
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

    const session = await prisma.twofactor_sessions.create({
        data: {
            account_id,
            campaign_id: campaign_id ?? null,
            purpose,
            channel,
            target,
            otp_hash: otpHash,
            otp_token: token,
            status: "PENDING",
            expires_at: expiresAt,
            max_attempts: MAX_ATTEMPTS,
        },
    });

    // ในระบบจริงควรส่ง OTP ผ่าน email/SMS via outbox_events
    // ตอนนี้เขียน outbox event เพื่อ log ว่า "ควรส่ง OTP"
    await prisma.service_outbox_events.create({
        data: {
            event_type: "OTP_SEND",
            aggregate_type: "twofactor_sessions",
            aggregate_id: session.id,
            payload: {
                account_id,
                purpose,
                channel,
                target,
                // ห้าม log OTP plaintext — ไม่ใส่ otp ใน payload
            },
        },
    });

    return { session_id: session.id, otp_token: token, expires_at: expiresAt };
}

export const otpService = {
    async request(input: OtpRequestBody) {
        const account = await prisma.accounts.findFirst({
            where: { id: input.account_id, active: true, deleted_at: null },
        });
        if (!account) throw new AppError("ไม่พบบัญชีผู้ใช้", 404);

        // ยกเลิก pending OTP เดิมของ account+purpose นี้ก่อน
        await prisma.twofactor_sessions.updateMany({
            where: {
                account_id: input.account_id,
                purpose: input.purpose,
                status: "PENDING",
                ...(input.campaign_id != null && { campaign_id: input.campaign_id }),
            },
            data: { status: "CANCELLED" },
        });

        const target = input.target ?? account.email ?? null;
        const channel = input.channel ?? "EMAIL";

        const result = await createOtpSession(
            input.account_id,
            input.purpose,
            input.campaign_id ?? null,
            channel,
            target,
        );

        return {
            success: true,
            message: `ส่ง OTP ไปยัง ${channel} สำเร็จ`,
            data: {
                otp_token: result.otp_token,
                expires_at: result.expires_at,
                // ห้าม return otp_code ใน production — dev only ให้ออก log เอาเอง
            },
        };
    },

    async verify(input: OtpVerifyBody) {
        const session = await prisma.twofactor_sessions.findFirst({
            where: { otp_token: input.otp_token, status: "PENDING" },
        });
        if (!session) throw new AppError("ไม่พบหรือ OTP ถูกใช้งานไปแล้ว", 404);

        if (new Date() > session.expires_at) {
            await prisma.twofactor_sessions.update({
                where: { id: session.id },
                data: { status: "EXPIRED" },
            });
            throw new AppError("OTP หมดอายุแล้ว", 400);
        }

        if (session.attempts >= session.max_attempts) {
            throw new AppError("ใส่ OTP ผิดครั้งเกิน กรุณาขอ OTP ใหม่", 400);
        }

        const isValid = await Bun.password.verify(input.otp_code, session.otp_hash);

        if (!isValid) {
            await prisma.twofactor_sessions.update({
                where: { id: session.id },
                data: { attempts: { increment: 1 } },
            });
            const remaining = session.max_attempts - session.attempts - 1;
            throw new AppError(`OTP ไม่ถูกต้อง เหลืออีก ${remaining} ครั้ง`, 400);
        }

        await prisma.twofactor_sessions.update({
            where: { id: session.id },
            data: { status: "VERIFIED", used_at: new Date() },
        });

        return {
            success: true,
            message: "ยืนยัน OTP สำเร็จ",
            data: {
                session_id: session.id,
                account_id: session.account_id,
                purpose: session.purpose,
                campaign_id: session.campaign_id,
            },
        };
    },

    async resend(input: OtpResendBody) {
        const session = await prisma.twofactor_sessions.findFirst({
            where: { otp_token: input.otp_token },
            include: { accounts: { select: { id: true, email: true, active: true } } },
        });
        if (!session) throw new AppError("ไม่พบ OTP session", 404);
        if (session.status === "VERIFIED") throw new AppError("OTP ถูกใช้งานไปแล้ว", 400);

        // ยกเลิก session เดิม แล้วสร้างใหม่
        await prisma.twofactor_sessions.update({
            where: { id: session.id },
            data: { status: "CANCELLED" },
        });

        const result = await createOtpSession(
            session.account_id,
            session.purpose,
            session.campaign_id ?? null,
            session.channel,
            session.target,
        );

        return {
            success: true,
            message: "ส่ง OTP ใหม่สำเร็จ",
            data: { otp_token: result.otp_token, expires_at: result.expires_at },
        };
    },

    async cancel(input: OtpCancelBody) {
        const session = await prisma.twofactor_sessions.findFirst({
            where: { otp_token: input.otp_token, status: "PENDING" },
        });
        if (!session) throw new AppError("ไม่พบ OTP session ที่ active", 404);

        await prisma.twofactor_sessions.update({
            where: { id: session.id },
            data: { status: "CANCELLED" },
        });

        return { success: true, message: "ยกเลิก OTP สำเร็จ" };
    },

    // ── Campaign Unlock ──────────────────────────────────────────────────────
    // Manager ขอ OTP สำหรับ unlock campaign
    async requestUnlock(campaignId: number, accountId: number) {
        const campaign = await prisma.exam_campaigns.findFirst({
            where: { id: campaignId, deleted_at: null },
        });
        if (!campaign) throw new AppError("ไม่พบรอบสอบ", 404);
        if (campaign.is_unlock) throw new AppError("รอบสอบนี้ถูก unlock แล้ว", 400);

        const account = await prisma.accounts.findFirst({
            where: { id: accountId, role_id: 3, active: true, deleted_at: null }, // role_id=3 MANAGER
        });
        if (!account) throw new AppError("บัญชีนี้ไม่ใช่ Manager", 403);
        if (account.manager_order == null) {
            throw new AppError("Manager บัญชีนี้ไม่มี manager_order กรุณาตั้งค่าก่อน", 400);
        }

        await prisma.twofactor_sessions.updateMany({
            where: { account_id: accountId, purpose: "UNLOCK_CAMPAIGN", campaign_id: campaignId, status: "PENDING" },
            data: { status: "CANCELLED" },
        });

        const result = await createOtpSession(accountId, "UNLOCK_CAMPAIGN", campaignId, "EMAIL", account.email);

        return {
            success: true,
            message: `ส่ง OTP สำหรับ unlock รอบสอบไปยัง email สำเร็จ (Manager order ${account.manager_order})`,
            data: { otp_token: result.otp_token, expires_at: result.expires_at },
        };
    },

    // Manager ยืนยัน OTP แล้ว unlock ถ้าครบ 2 managers
    async confirmUnlock(campaignId: number, input: OtpVerifyBody) {
        const campaign = await prisma.exam_campaigns.findFirst({
            where: { id: campaignId, deleted_at: null },
        });
        if (!campaign) throw new AppError("ไม่พบรอบสอบ", 404);
        if (campaign.is_unlock) throw new AppError("รอบสอบนี้ถูก unlock แล้ว", 400);

        // verify OTP
        const verifyResult = await otpService.verify(input);
        if (verifyResult.data.campaign_id !== campaignId) {
            throw new AppError("OTP นี้ไม่ใช่สำหรับรอบสอบนี้", 400);
        }
        if (verifyResult.data.purpose !== "UNLOCK_CAMPAIGN") {
            throw new AppError("OTP นี้ไม่ใช่สำหรับ unlock", 400);
        }

        // ตรวจว่า managers ที่ verify แล้วครบ 2 คนหรือยัง
        const verifiedSessions = await prisma.twofactor_sessions.findMany({
            where: { campaign_id: campaignId, purpose: "UNLOCK_CAMPAIGN", status: "VERIFIED" },
            include: { accounts: { select: { id: true, manager_order: true, full_name: true } } },
        });

        const verifiedOrders = verifiedSessions
            .map((s) => s.accounts.manager_order)
            .filter((o): o is number => o !== null);

        const hasOrder1 = verifiedOrders.includes(1);
        const hasOrder2 = verifiedOrders.includes(2);

        // Log ว่า manager นี้ verify แล้ว (ทำทุกครั้ง ไม่ใช่แค่ตอน unlock)
        await prisma.activity_logs.create({
            data: {
                actor_type: "ACCOUNT",
                account_id: verifyResult.data.account_id,
                action: "CAMPAIGN_UNLOCK_VERIFY",
                object_type: "exam_campaigns",
                object_id: campaignId,
                details: {
                    managerOrder: verifiedSessions.find((s) => s.account_id === verifyResult.data.account_id)?.accounts.manager_order,
                    accountId: verifyResult.data.account_id,
                    otpSessionId: verifyResult.data.session_id,
                    campaignId,
                },
            },
        });

        if (hasOrder1 && hasOrder2) {
            // ครบทั้ง 2 managers → unlock campaign
            const m1 = verifiedSessions.find((s) => s.accounts.manager_order === 1);
            const m2 = verifiedSessions.find((s) => s.accounts.manager_order === 2);

            await prisma.$transaction(async (tx) => {
                await tx.exam_campaigns.update({
                    where: { id: campaignId },
                    data: { is_unlock: true },
                });
                await tx.activity_logs.create({
                    data: {
                        actor_type: "ACCOUNT",
                        account_id: verifyResult.data.account_id,
                        action: "CAMPAIGN_UNLOCK",
                        object_type: "exam_campaigns",
                        object_id: campaignId,
                        details: {
                            manager1AccountId: m1?.account_id,
                            manager2AccountId: m2?.account_id,
                            unlockedAt: new Date().toISOString(),
                            campaignId,
                        },
                    },
                });
            });

            return {
                success: true,
                message: "✅ ยืนยัน OTP สำเร็จ และ UNLOCK รอบสอบเรียบร้อย",
                data: { campaign_unlocked: true, verified_manager_orders: verifiedOrders },
            };
        }

        return {
            success: true,
            message: `ยืนยัน OTP สำเร็จ รอ Manager อีก ${hasOrder1 ? "order 2" : "order 1"} ยืนยัน`,
            data: { campaign_unlocked: false, verified_manager_orders: verifiedOrders },
        };
    },
};
