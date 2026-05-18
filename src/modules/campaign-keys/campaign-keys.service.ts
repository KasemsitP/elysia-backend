import { prisma } from "../../cores/prisma";
import { AppError } from "../../cores/errors";
import {
    hashManagerKey,
    verifyManagerKey,
    deriveKEK,
    generateDEK,
    wrapDEK,
    unwrapDEK,
    MANAGER_KEY_ORDER_1,
    MANAGER_KEY_ORDER_2,
    DEK_RECORD_ORDER,
} from "../../cores/kek-crypto";

// ── Internal helpers ──────────────────────────────────────────────────────────

async function getManagerKeyRecord(campaign_id: number, order_num: number) {
    return prisma.campaign_keys.findFirst({
        where: { campaign_id, order_num, active: true, deleted_at: null },
        include: { accounts: { select: { id: true, full_name: true, manager_order: true } } },
    });
}

async function getDekRecord(campaign_id: number) {
    return prisma.campaign_keys.findFirst({
        where: { campaign_id, order_num: DEK_RECORD_ORDER, active: true, deleted_at: null },
    });
}

// ── Public API ────────────────────────────────────────────────────────────────

export const campaignKeyService = {
    /**
     * Setup keys ครั้งแรก (หรือ rotate ทั้งชุด)
     *
     * ต้องการ:
     * - Manager 1 และ Manager 2 ที่มี manager_order ตรงกัน
     * - Plaintext key ของแต่ละคน (ไม่เคยเก็บ — hash แล้วทิ้งทันที)
     *
     * สิ่งที่เกิดขึ้น:
     * 1. hash(MK1) + salt → DB (order_num=1)
     * 2. hash(MK2) + salt → DB (order_num=2)
     * 3. DEK = random 16 bytes
     * 4. KEK = HKDF(MK1 ‖ MK2, campaignId)
     * 5. wrapped_DEK = AES-256-GCM(KEK, DEK) → DB (order_num=99)
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

        // ตรวจสอบ manager 1
        const m1 = await prisma.accounts.findFirst({
            where: { id: m1AccountId, role_id: 3, active: true, deleted_at: null },
        });
        if (!m1) throw new AppError("ไม่พบ Manager 1 หรือไม่มีสิทธิ์", 403);
        if (m1.manager_order !== 1) throw new AppError("Manager 1 ต้องมี manager_order = 1", 400);

        // ตรวจสอบ manager 2
        const m2 = await prisma.accounts.findFirst({
            where: { id: m2AccountId, role_id: 3, active: true, deleted_at: null },
        });
        if (!m2) throw new AppError("ไม่พบ Manager 2 หรือไม่มีสิทธิ์", 403);
        if (m2.manager_order !== 2) throw new AppError("Manager 2 ต้องมี manager_order = 2", 400);
        if (m1AccountId === m2AccountId) throw new AppError("Manager 1 และ 2 ต้องเป็นคนละบัญชี", 400);

        // ตรวจสอบว่ายังไม่เคย setup (ป้องกัน overwrite โดยไม่ตั้งใจ)
        const existingDek = await getDekRecord(campaignId);
        if (existingDek) {
            throw new AppError("Campaign นี้มี key อยู่แล้ว ใช้ rotate-keys endpoint แทน", 409);
        }

        // Hash manager keys (plaintext จะไม่ถูกเก็บหลังจากนี้)
        const mk1Hash = hashManagerKey(mk1Plaintext);
        const mk2Hash = hashManagerKey(mk2Plaintext);

        // Derive KEK + Generate DEK + Wrap DEK
        const kek = deriveKEK(mk1Plaintext, mk2Plaintext, campaignId);
        const dek = generateDEK();
        const wrappedDek = wrapDEK(dek, kek);

        // เก็บทุกอย่างใน transaction
        await prisma.$transaction(async (tx) => {
            // Deactivate records เดิม (ถ้ามี)
            await tx.campaign_keys.updateMany({
                where: { campaign_id: campaignId, order_num: { in: [MANAGER_KEY_ORDER_1, MANAGER_KEY_ORDER_2, DEK_RECORD_ORDER] } },
                data: { active: false },
            });

            // Manager 1 hash record
            await tx.campaign_keys.create({
                data: {
                    campaign_id: campaignId,
                    account_id: m1AccountId,
                    order_num: MANAGER_KEY_ORDER_1,
                    key_ciphertext: mk1Hash.hash, // PBKDF2 hash
                    iv: mk1Hash.salt,             // PBKDF2 salt
                    algor: "PBKDF2-SHA256",
                    active: true,
                },
            });

            // Manager 2 hash record
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

            // Encrypted DEK record (KEK ถูก derive ในหน่วยความจำ ไม่เก็บ)
            await tx.campaign_keys.create({
                data: {
                    campaign_id: campaignId,
                    account_id: null,
                    order_num: DEK_RECORD_ORDER,
                    key_ciphertext: wrappedDek, // AES-256-GCM(KEK, DEK)
                    iv: null,                   // iv อยู่ภายใน wrappedDek JSON
                    algor: "AES-256-GCM-WRAPPED",
                    active: true,
                },
            });
        });

        // ล้าง sensitive data จากหน่วยความจำ
        kek.fill(0);
        dek.fill(0);

        return {
            success: true,
            message: "ตั้งค่า campaign keys สำเร็จ",
            data: {
                campaign_id: campaignId,
                manager1: { account_id: m1AccountId, full_name: m1.full_name },
                manager2: { account_id: m2AccountId, full_name: m2.full_name },
                dek_encrypted: true,
            },
        };
    },

    /**
     * ตรวจสอบ manager keys ทั้ง 2 ชุด และ return DEK (ในหน่วยความจำ)
     * DEK ไม่เคยถูกเก็บ plaintext — ต้องทำใหม่ทุกครั้งที่ต้องการ
     *
     * ใช้ภายใน server เท่านั้น ไม่ return DEK ออก API
     */
    async getDecryptedDEK(
        campaignId: number,
        mk1Plaintext: string,
        mk2Plaintext: string,
    ): Promise<Buffer> {
        const [mk1Record, mk2Record, dekRecord] = await Promise.all([
            getManagerKeyRecord(campaignId, MANAGER_KEY_ORDER_1),
            getManagerKeyRecord(campaignId, MANAGER_KEY_ORDER_2),
            getDekRecord(campaignId),
        ]);

        if (!mk1Record?.key_ciphertext || !mk1Record.iv) {
            throw new AppError("ไม่พบ Manager Key 1 — กรุณา setup keys ก่อน", 404);
        }
        if (!mk2Record?.key_ciphertext || !mk2Record.iv) {
            throw new AppError("ไม่พบ Manager Key 2 — กรุณา setup keys ก่อน", 404);
        }
        if (!dekRecord?.key_ciphertext) {
            throw new AppError("ไม่พบ Encrypted DEK — กรุณา setup keys ก่อน", 404);
        }

        // Verify MK1
        if (!verifyManagerKey(mk1Plaintext, mk1Record.key_ciphertext, mk1Record.iv)) {
            throw new AppError("Manager Key 1 ไม่ถูกต้อง", 401);
        }
        // Verify MK2
        if (!verifyManagerKey(mk2Plaintext, mk2Record.key_ciphertext, mk2Record.iv)) {
            throw new AppError("Manager Key 2 ไม่ถูกต้อง", 401);
        }

        // Derive KEK (ในหน่วยความจำ ไม่เก็บ)
        const kek = deriveKEK(mk1Plaintext, mk2Plaintext, campaignId);

        // Unwrap DEK (ถ้า key ผิดหรือ tamper → throw)
        const dek = unwrapDEK(dekRecord.key_ciphertext, kek);

        // ล้าง KEK จากหน่วยความจำ
        kek.fill(0);

        return dek;
    },

    /** แสดงสถานะ keys (ไม่ return hash / plaintext) */
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
        const dek = records.find((r) => r.order_num === DEK_RECORD_ORDER);

        return {
            success: true,
            message: "ดึงสถานะ keys สำเร็จ",
            data: {
                campaign_id: campaignId,
                is_setup: !!mk1 && !!mk2 && !!dek,
                manager1_key: mk1
                    ? { set: true, manager: mk1.accounts, algor: mk1.algor, created_at: mk1.created_at }
                    : { set: false },
                manager2_key: mk2
                    ? { set: true, manager: mk2.accounts, algor: mk2.algor, created_at: mk2.created_at }
                    : { set: false },
                dek: dek
                    ? { wrapped: true, algor: dek.algor, created_at: dek.created_at }
                    : { wrapped: false },
            },
        };
    },

    /**
     * Rotate keys ทั้งชุด — ต้องให้ manager ทั้ง 2 ให้ key ใหม่
     * DEK ใหม่จะถูก generate และ wrap ด้วย KEK ใหม่
     * Booklets เก่าจะถอดรหัสไม่ได้ถ้าไม่ re-encrypt (ระวัง)
     */
    async rotateKeys(
        campaignId: number,
        m1AccountId: number,
        mk1NewPlaintext: string,
        m2AccountId: number,
        mk2NewPlaintext: string,
    ) {
        // ลบ existing setup flag ชั่วคราว เพื่อให้ setupKeys ทำงานได้
        await prisma.campaign_keys.updateMany({
            where: { campaign_id: campaignId, order_num: DEK_RECORD_ORDER },
            data: { active: false },
        });
        // ใช้ setupKeys ทำงานให้ (มี validation ครบแล้ว)
        await prisma.campaign_keys.updateMany({
            where: { campaign_id: campaignId },
            data: { active: false },
        });
        return campaignKeyService.setupKeys(campaignId, m1AccountId, mk1NewPlaintext, m2AccountId, mk2NewPlaintext);
    },

    /** ตรวจสอบ key โดยไม่ return DEK — ใช้สำหรับ verify ก่อนทำงานสำคัญ */
    async verifyKeys(campaignId: number, mk1: string, mk2: string) {
        try {
            const dek = await campaignKeyService.getDecryptedDEK(campaignId, mk1, mk2);
            dek.fill(0);
            return { success: true, message: "Manager keys ถูกต้องทั้งคู่" };
        } catch (e) {
            if (e instanceof AppError) throw e;
            throw new AppError("ตรวจสอบ keys ไม่สำเร็จ", 400);
        }
    },
};
