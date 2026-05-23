import { prisma } from "../../cores/prisma";
import { AppError } from "../../cores/errors";
import {
    hashManagerKey,
    verifyManagerKey,
    deriveCombinedKey,
    MANAGER_KEY_ORDER_1,
    MANAGER_KEY_ORDER_2,
} from "../../cores/kek-crypto";

// ── Internal helpers ──────────────────────────────────────────────────────────

async function getManagerKeyRecord(campaign_id: number, order_num: number) {
    return prisma.campaign_keys.findFirst({
        where: { campaign_id, order_num, active: true, deleted_at: null },
        include: { accounts: { select: { id: true, full_name: true, manager_order: true } } },
    });
}

// ── Public API ────────────────────────────────────────────────────────────────

export const campaignKeyService = {
    /**
     * Setup keys ครั้งแรก (หรือ rotate ทั้งชุด)
     *
     * สิ่งที่เกิดขึ้น:
     * 1. hash(MK1) + salt → DB (order_num=1)
     * 2. hash(MK2) + salt → DB (order_num=2)
     *
     * combinedKey derive ได้จาก MK1+MK2 ทุกครั้งที่ต้องการ — ไม่เก็บใน DB
     */
    async setupKeys(
        campaignId: number,
        m1AccountId: number,
        mk1Plaintext: string,
        m2AccountId: number,
        mk2Plaintext: string,
    ) {
        const campaign = await prisma.exam_campaigns.findFirst({
            where: { id: campaignId, deleted_at: null },
        });
        if (!campaign) throw new AppError("ไม่พบรอบสอบ", 404);

        const m1 = await prisma.accounts.findFirst({
            where: { id: m1AccountId, role_id: 3, active: true, deleted_at: null },
        });
        if (!m1) throw new AppError("ไม่พบ Manager 1 หรือไม่มีสิทธิ์", 403);
        if (m1.manager_order !== 1) throw new AppError("Manager 1 ต้องมี manager_order = 1", 400);

        const m2 = await prisma.accounts.findFirst({
            where: { id: m2AccountId, role_id: 3, active: true, deleted_at: null },
        });
        if (!m2) throw new AppError("ไม่พบ Manager 2 หรือไม่มีสิทธิ์", 403);
        if (m2.manager_order !== 2) throw new AppError("Manager 2 ต้องมี manager_order = 2", 400);
        if (m1AccountId === m2AccountId) throw new AppError("Manager 1 และ 2 ต้องเป็นคนละบัญชี", 400);

        const existingMk1 = await getManagerKeyRecord(campaignId, MANAGER_KEY_ORDER_1);
        if (existingMk1) {
            throw new AppError("Campaign นี้มี key อยู่แล้ว ใช้ rotate-keys endpoint แทน", 409);
        }

        const mk1Hash = hashManagerKey(mk1Plaintext);
        const mk2Hash = hashManagerKey(mk2Plaintext);

        await prisma.$transaction(async (tx) => {
            await tx.campaign_keys.updateMany({
                where: { campaign_id: campaignId, order_num: { in: [MANAGER_KEY_ORDER_1, MANAGER_KEY_ORDER_2] } },
                data: { active: false },
            });

            await tx.campaign_keys.create({
                data: {
                    campaign_id: campaignId,
                    account_id: m1AccountId,
                    order_num: MANAGER_KEY_ORDER_1,
                    key_ciphertext: mk1Hash.hash,
                    iv: mk1Hash.salt,
                    algor: "PBKDF2-SHA256",
                    active: true,
                },
            });

            await tx.campaign_keys.create({
                data: {
                    campaign_id: campaignId,
                    account_id: m2AccountId,
                    order_num: MANAGER_KEY_ORDER_2,
                    key_ciphertext: mk2Hash.hash,
                    iv: mk2Hash.salt,
                    algor: "PBKDF2-SHA256",
                    active: true,
                },
            });
        });

        return {
            success: true,
            message: "ตั้งค่า campaign keys สำเร็จ",
            data: {
                campaign_id: campaignId,
                manager1: { account_id: m1AccountId, full_name: m1.full_name },
                manager2: { account_id: m2AccountId, full_name: m2.full_name },
            },
        };
    },

    /**
     * ตรวจสอบ manager keys ทั้ง 2 ชุด และ return combinedKey (ในหน่วยความจำ)
     * combinedKey ไม่เคยถูกเก็บ — derive ใหม่ทุกครั้งที่ต้องการ
     */
    async getCombinedKey(
        campaignId: number,
        mk1Plaintext: string,
        mk2Plaintext: string,
    ): Promise<Buffer> {
        const [mk1Record, mk2Record] = await Promise.all([
            getManagerKeyRecord(campaignId, MANAGER_KEY_ORDER_1),
            getManagerKeyRecord(campaignId, MANAGER_KEY_ORDER_2),
        ]);

        if (!mk1Record?.key_ciphertext || !mk1Record.iv) {
            throw new AppError("ไม่พบ Manager Key 1 — กรุณา setup keys ก่อน", 404);
        }
        if (!mk2Record?.key_ciphertext || !mk2Record.iv) {
            throw new AppError("ไม่พบ Manager Key 2 — กรุณา setup keys ก่อน", 404);
        }

        if (!verifyManagerKey(mk1Plaintext, mk1Record.key_ciphertext, mk1Record.iv)) {
            throw new AppError("Manager Key 1 ไม่ถูกต้อง", 401);
        }
        if (!verifyManagerKey(mk2Plaintext, mk2Record.key_ciphertext, mk2Record.iv)) {
            throw new AppError("Manager Key 2 ไม่ถูกต้อง", 401);
        }

        return deriveCombinedKey(mk1Plaintext, mk2Plaintext, campaignId);
    },

    /**
     * เหมือน getCombinedKey แต่ตรวจ is_unlock ก่อน — ใช้สำหรับ decrypt เท่านั้น
     * ถ้าสอบยังไม่เสร็จ (is_unlock = false) → throw 403
     */
    async getCombinedKeyForDecrypt(
        campaignId: number,
        mk1Plaintext: string,
        mk2Plaintext: string,
    ): Promise<Buffer> {
        const campaign = await prisma.exam_campaigns.findFirst({
            where: { id: campaignId, deleted_at: null },
            select: { is_unlock: true },
        });
        if (!campaign) throw new AppError("ไม่พบรอบสอบ", 404);
        if (!campaign.is_unlock) {
            throw new AppError("ไม่สามารถถอดรหัสได้ — รอบสอบยังไม่ unlock", 403);
        }
        return campaignKeyService.getCombinedKey(campaignId, mk1Plaintext, mk2Plaintext);
    },

    async getKeyStatus(campaignId: number) {
        const records = await prisma.campaign_keys.findMany({
            where: { campaign_id: campaignId, deleted_at: null },
            select: {
                order_num: true,
                algor: true,
                active: true,
                created_at: true,
                accounts: { select: { id: true, full_name: true, manager_order: true } },
            },
            orderBy: { order_num: "asc" },
        });

        const mk1 = records.find((r) => r.order_num === MANAGER_KEY_ORDER_1);
        const mk2 = records.find((r) => r.order_num === MANAGER_KEY_ORDER_2);

        return {
            success: true,
            message: "ดึงสถานะ keys สำเร็จ",
            data: {
                campaign_id: campaignId,
                is_setup: !!mk1 && !!mk2,
                manager1_key: mk1
                    ? { set: true, manager: mk1.accounts, algor: mk1.algor, created_at: mk1.created_at }
                    : { set: false },
                manager2_key: mk2
                    ? { set: true, manager: mk2.accounts, algor: mk2.algor, created_at: mk2.created_at }
                    : { set: false },
            },
        };
    },

    async rotateKeys(
        campaignId: number,
        m1AccountId: number,
        mk1NewPlaintext: string,
        m2AccountId: number,
        mk2NewPlaintext: string,
    ) {
        await prisma.campaign_keys.updateMany({
            where: { campaign_id: campaignId },
            data: { active: false },
        });
        return campaignKeyService.setupKeys(campaignId, m1AccountId, mk1NewPlaintext, m2AccountId, mk2NewPlaintext);
    },

    async verifyKeys(campaignId: number, mk1: string, mk2: string) {
        try {
            const key = await campaignKeyService.getCombinedKey(campaignId, mk1, mk2);
            key.fill(0);
            return { success: true, message: "Manager keys ถูกต้องทั้งคู่" };
        } catch (e) {
            if (e instanceof AppError) throw e;
            throw new AppError("ตรวจสอบ keys ไม่สำเร็จ", 400);
        }
    },
};
