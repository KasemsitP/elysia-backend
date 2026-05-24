import { prisma } from "../../cores/prisma";
import { AppError } from "../../cores/errors";
import {
    wrapManagerKey,
    unwrapManagerKey,
    timingSafeStringEqual,
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
     * 1. AES-256-GCM(MASTER_KEY, MK1) → key_ciphertext (order_num=1)
     * 2. AES-256-GCM(MASTER_KEY, MK2) → key_ciphertext (order_num=2)
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

        // Encrypt each MK with MASTER_KEY — plaintext never stored
        const mk1Wrapped = wrapManagerKey(mk1Plaintext);
        const mk2Wrapped = wrapManagerKey(mk2Plaintext);

        await prisma.$transaction(async (tx) => {
            await tx.campaign_keys.updateMany({
                where: { campaign_id: campaignId, order_num: { in: [MANAGER_KEY_ORDER_1, MANAGER_KEY_ORDER_2] } },
                data: { active: false },
            });

            await tx.campaign_keys.create({
                data: {
                    campaign_id:    campaignId,
                    account_id:     m1AccountId,
                    order_num:      MANAGER_KEY_ORDER_1,
                    key_ciphertext: mk1Wrapped,
                    iv:             null,
                    algor:          "AES-256-GCM",
                    active:         true,
                },
            });

            await tx.campaign_keys.create({
                data: {
                    campaign_id:    campaignId,
                    account_id:     m2AccountId,
                    order_num:      MANAGER_KEY_ORDER_2,
                    key_ciphertext: mk2Wrapped,
                    iv:             null,
                    algor:          "AES-256-GCM",
                    active:         true,
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
     * อ่าน MK1/MK2 จาก DB → ถอดรหัสด้วย MASTER_KEY → derive combinedKey
     * ไม่ต้องการ manager input — ใช้ได้โดยระบบโดยตรง
     */
    async getCombinedKey(campaignId: number): Promise<Buffer> {
        const [mk1Record, mk2Record] = await Promise.all([
            getManagerKeyRecord(campaignId, MANAGER_KEY_ORDER_1),
            getManagerKeyRecord(campaignId, MANAGER_KEY_ORDER_2),
        ]);

        if (!mk1Record?.key_ciphertext) {
            throw new AppError("ไม่พบ Manager Key 1 — กรุณา setup keys ก่อน", 404);
        }
        if (!mk2Record?.key_ciphertext) {
            throw new AppError("ไม่พบ Manager Key 2 — กรุณา setup keys ก่อน", 404);
        }

        const mk1Plaintext = unwrapManagerKey(mk1Record.key_ciphertext);
        const mk2Plaintext = unwrapManagerKey(mk2Record.key_ciphertext);

        const combined = deriveCombinedKey(mk1Plaintext, mk2Plaintext, campaignId);

        // Zero plaintext from memory
        Buffer.from(mk1Plaintext, "utf8").fill(0);
        Buffer.from(mk2Plaintext, "utf8").fill(0);

        return combined;
    },

    /**
     * เหมือน getCombinedKey แต่ตรวจ is_unlock ก่อน — ใช้สำหรับ decrypt เท่านั้น
     * ถ้าสอบยังไม่เสร็จ (is_unlock = false) → throw 403
     */
    async getCombinedKeyForDecrypt(campaignId: number): Promise<Buffer> {
        const campaign = await prisma.exam_campaigns.findFirst({
            where: { id: campaignId, deleted_at: null },
            select: { is_unlock: true },
        });
        if (!campaign) throw new AppError("ไม่พบรอบสอบ", 404);
        if (!campaign.is_unlock) {
            throw new AppError("ไม่สามารถถอดรหัสได้ — รอบสอบยังไม่ unlock", 403);
        }
        return campaignKeyService.getCombinedKey(campaignId);
    },

    /**
     * Manager กรอก key ของตัวเองทีละคน — ดึง manager_order จาก account ใน DB
     * ไม่ต้องส่ง account_id มาใน body (ดึงจาก session แทน)
     */
    async setMyKey(campaignId: number, accountId: number, keyPlaintext: string) {
        const campaign = await prisma.exam_campaigns.findFirst({
            where: { id: campaignId, deleted_at: null },
        });
        if (!campaign) throw new AppError("ไม่พบรอบสอบ", 404);

        const account = await prisma.accounts.findFirst({
            where: { id: accountId, role_id: 3, active: true, deleted_at: null },
        });
        if (!account) throw new AppError("ไม่พบบัญชี Manager หรือไม่มีสิทธิ์", 403);
        if (account.manager_order !== 1 && account.manager_order !== 2) {
            throw new AppError("บัญชีนี้ไม่มี manager_order — กรุณาตั้งค่าก่อน", 400);
        }

        const orderNum = account.manager_order as 1 | 2;
        const wrapped = wrapManagerKey(keyPlaintext);

        await prisma.$transaction(async (tx) => {
            await tx.campaign_keys.updateMany({
                where: { campaign_id: campaignId, order_num: orderNum },
                data: { active: false },
            });
            await tx.campaign_keys.create({
                data: {
                    campaign_id:    campaignId,
                    account_id:     accountId,
                    order_num:      orderNum,
                    key_ciphertext: wrapped,
                    iv:             null,
                    algor:          "AES-256-GCM",
                    active:         true,
                },
            });
        });

        return {
            success: true,
            message: `บันทึก Manager Key ${orderNum} สำเร็จ`,
            data: { campaign_id: campaignId, manager_order: orderNum, full_name: account.full_name },
        };
    },

    async getAvailableManagers() {
        const managers = await prisma.accounts.findMany({
            where: { role_id: 3, active: true, deleted_at: null },
            select: { id: true, full_name: true, manager_order: true },
            orderBy: { manager_order: "asc" },
        });
        return {
            success: true,
            message: "ดึงรายชื่อ Manager สำเร็จ",
            data: managers,
        };
    },

    async getKeyStatus(campaignId: number) {
        const records = await prisma.campaign_keys.findMany({
            where: { campaign_id: campaignId, active: true, deleted_at: null },
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

    /**
     * ADMIN: ทดสอบว่าสามารถ derive combinedKey ได้จริง — ใช้เป็น "readiness check"
     * ก่อนสร้าง booklets/QR payloads
     */
    async validateEncryptionReady(campaignId: number) {
        const combined = await campaignKeyService.getCombinedKey(campaignId);
        combined.fill(0); // zero ทันทีหลัง verify
        return {
            success: true,
            message: "คีย์พร้อมใช้งาน — สามารถสร้าง QR payload ได้",
        };
    },

    /**
     * ตรวจว่า MK ที่ผู้จัดการให้มาตรงกับที่เก็บใน DB (constant-time compare)
     * ใช้สำหรับยืนยันตัวตนผู้จัดการ โดยไม่เปลี่ยนแปลงข้อมูลใด
     */
    async verifyKeys(campaignId: number, mk1: string, mk2: string) {
        const [mk1Record, mk2Record] = await Promise.all([
            getManagerKeyRecord(campaignId, MANAGER_KEY_ORDER_1),
            getManagerKeyRecord(campaignId, MANAGER_KEY_ORDER_2),
        ]);

        if (!mk1Record?.key_ciphertext) {
            throw new AppError("ไม่พบ Manager Key 1 — กรุณา setup keys ก่อน", 404);
        }
        if (!mk2Record?.key_ciphertext) {
            throw new AppError("ไม่พบ Manager Key 2 — กรุณา setup keys ก่อน", 404);
        }

        const storedMk1 = unwrapManagerKey(mk1Record.key_ciphertext);
        const storedMk2 = unwrapManagerKey(mk2Record.key_ciphertext);

        if (!timingSafeStringEqual(mk1, storedMk1)) throw new AppError("Manager Key 1 ไม่ถูกต้อง", 401);
        if (!timingSafeStringEqual(mk2, storedMk2)) throw new AppError("Manager Key 2 ไม่ถูกต้อง", 401);

        return { success: true, message: "Manager keys ถูกต้องทั้งคู่" };
    },
};
