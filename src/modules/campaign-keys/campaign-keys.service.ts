import { prisma, type Tx } from "../../cores/prisma";
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

/**
 * Block key change if packaging has already started (bags exist for the campaign).
 */
async function assertKeyChangeable(campaignId: number): Promise<void> {
    const bagsCount = await prisma.bags.count({
        where: { campaign_id: campaignId, deleted_at: null },
    });
    if (bagsCount > 0) {
        throw new AppError(
            "ไม่สามารถเปลี่ยน Manager Key ได้ — มีการแพ็คถุงข้อสอบแล้ว กรุณาติดต่อผู้ดูแลระบบ",
            409,
        );
    }
}

/**
 * Mark all booklets and generated signsheet PDFs for a campaign as stale.
 * Called inside a transaction whenever a manager key changes.
 */
async function markCampaignStale(tx: Tx, campaignId: number): Promise<void> {
    await tx.booklets.updateMany({
        where: { campaign_id: campaignId, deleted_at: null },
        data: { qr_status: "STALE" },
    });
    await tx.sessions.updateMany({
        where: {
            campaign_id: campaignId,
            deleted_at: null,
            signsheet_status: { not: "NOT_GENERATED" },
        },
        data: { signsheet_status: "STALE" },
    });
}

/**
 * Upsert a single manager key record.
 *
 * - If a record already exists for (campaignId, orderNum): UPDATE it in place
 *   (avoiding the unique-constraint violation that INSERT would cause).
 * - If no record exists: CREATE one.
 * - Returns whether the key material actually changed (used to decide staleness).
 */
async function upsertKeyRecord(
    tx: Tx,
    campaignId: number,
    accountId: number,
    orderNum: number,
    newPlaintext: string,
): Promise<boolean> {
    const wrapped = wrapManagerKey(newPlaintext);

    const existing = await tx.campaign_keys.findFirst({
        where: { campaign_id: campaignId, order_num: orderNum, deleted_at: null },
    });

    if (!existing) {
        await tx.campaign_keys.create({
            data: {
                campaign_id:    campaignId,
                account_id:     accountId,
                order_num:      orderNum,
                key_ciphertext: wrapped,
                iv:             null,
                algor:          "AES-256-GCM",
                active:         true,
                key_version:    1,
            },
        });
        return true; // first-time creation counts as a change
    }

    // Compare new plaintext against stored ciphertext
    let changed = false;
    if (existing.key_ciphertext) {
        try {
            const stored = unwrapManagerKey(existing.key_ciphertext);
            changed = !timingSafeStringEqual(newPlaintext, stored);
            Buffer.from(stored, "utf8").fill(0);
        } catch {
            changed = true; // can't decrypt → treat as changed
        }
    } else {
        changed = true;
    }

    await tx.campaign_keys.update({
        where: { id: existing.id },
        data: {
            account_id:     accountId,
            key_ciphertext: wrapped,
            algor:          "AES-256-GCM",
            active:         true,
            key_version:    changed ? existing.key_version + 1 : existing.key_version,
        },
    });

    return changed;
}

// ── Public API ────────────────────────────────────────────────────────────────

export const campaignKeyService = {
    /**
     * Setup keys ครั้งแรก — ทั้ง 2 key พร้อมกัน
     * ถ้ามี active key อยู่แล้ว → throw 409 (ใช้ rotate-keys แทน)
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

        await prisma.$transaction(async (tx) => {
            await upsertKeyRecord(tx, campaignId, m1AccountId, MANAGER_KEY_ORDER_1, mk1Plaintext);
            await upsertKeyRecord(tx, campaignId, m2AccountId, MANAGER_KEY_ORDER_2, mk2Plaintext);
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

        Buffer.from(mk1Plaintext, "utf8").fill(0);
        Buffer.from(mk2Plaintext, "utf8").fill(0);

        return combined;
    },

    /**
     * เหมือน getCombinedKey แต่ตรวจ is_unlock ก่อน — ใช้สำหรับ decrypt เท่านั้น
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
     * Manager กรอก key ของตัวเองทีละคน — account_id ดึงจาก session
     *
     * - ถ้า key เปลี่ยนจริง → mark booklets และ signsheet ว่า STALE
     * - ถ้า key เหมือนเดิม → ไม่มีผลกระทบกับ booklets/PDF
     * - ถ้ามีการแพ็คถุงแล้ว → throw 409 (ป้องกัน key rotate ระหว่างสอบ)
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

        // Block key change if packaging has started
        const existingKey = await prisma.campaign_keys.findFirst({
            where: { campaign_id: campaignId, order_num: orderNum, deleted_at: null },
        });
        if (existingKey) {
            await assertKeyChangeable(campaignId);
        }

        let changed = false;
        await prisma.$transaction(async (tx) => {
            changed = await upsertKeyRecord(tx, campaignId, accountId, orderNum, keyPlaintext);
            if (changed) {
                await markCampaignStale(tx, campaignId);
            }
        });

        return {
            success: true,
            message: `บันทึก Manager Key ${orderNum} สำเร็จ${changed ? " — booklets ถูกทำเครื่องหมาย STALE" : ""}`,
            data: {
                campaign_id:   campaignId,
                manager_order: orderNum,
                full_name:     account.full_name,
                key_changed:   changed,
            },
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
                order_num:   true,
                key_version: true,
                algor:       true,
                active:      true,
                created_at:  true,
                updated_at:  true,
                accounts:    { select: { id: true, full_name: true, manager_order: true } },
            },
            orderBy: { order_num: "asc" },
        });

        const mk1 = records.find((r) => r.order_num === MANAGER_KEY_ORDER_1);
        const mk2 = records.find((r) => r.order_num === MANAGER_KEY_ORDER_2);

        // Aggregate stale counts across all sessions in the campaign
        const [staleBookletsCount, staleSessionsCount] = await Promise.all([
            prisma.booklets.count({
                where: { campaign_id: campaignId, qr_status: "STALE", deleted_at: null },
            }),
            prisma.sessions.count({
                where: { campaign_id: campaignId, signsheet_status: "STALE", deleted_at: null },
            }),
        ]);

        return {
            success: true,
            message: "ดึงสถานะ keys สำเร็จ",
            data: {
                campaign_id: campaignId,
                is_setup:    !!mk1 && !!mk2,
                manager1_key: mk1
                    ? { set: true, manager: mk1.accounts, algor: mk1.algor, key_version: mk1.key_version, created_at: mk1.created_at, updated_at: mk1.updated_at }
                    : { set: false },
                manager2_key: mk2
                    ? { set: true, manager: mk2.accounts, algor: mk2.algor, key_version: mk2.key_version, created_at: mk2.created_at, updated_at: mk2.updated_at }
                    : { set: false },
                stale: {
                    booklets_count: staleBookletsCount,
                    sessions_count: staleSessionsCount,
                    needs_regeneration: staleBookletsCount > 0 || staleSessionsCount > 0,
                },
            },
        };
    },

    /**
     * เปลี่ยน key ทั้งชุดพร้อมกัน (admin กำหนด MK1+MK2 ใหม่)
     * - ถ้ามีการแพ็คถุงแล้ว → throw 409
     * - ถ้า key เปลี่ยน → mark booklets/PDF ว่า STALE
     */
    async rotateKeys(
        campaignId: number,
        m1AccountId: number,
        mk1NewPlaintext: string,
        m2AccountId: number,
        mk2NewPlaintext: string,
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

        await assertKeyChangeable(campaignId);

        let anyChanged = false;
        await prisma.$transaction(async (tx) => {
            const [c1, c2] = await Promise.all([
                upsertKeyRecord(tx, campaignId, m1AccountId, MANAGER_KEY_ORDER_1, mk1NewPlaintext),
                upsertKeyRecord(tx, campaignId, m2AccountId, MANAGER_KEY_ORDER_2, mk2NewPlaintext),
            ]);
            anyChanged = c1 || c2;
            if (anyChanged) {
                await markCampaignStale(tx, campaignId);
            }
        });

        return {
            success: true,
            message: `เปลี่ยน campaign keys สำเร็จ${anyChanged ? " — booklets ถูกทำเครื่องหมาย STALE" : " (key เหมือนเดิม ไม่มีการเปลี่ยนแปลง)"}`,
            data: {
                campaign_id: campaignId,
                key_changed: anyChanged,
                manager1: { account_id: m1AccountId, full_name: m1.full_name },
                manager2: { account_id: m2AccountId, full_name: m2.full_name },
            },
        };
    },

    /**
     * ADMIN: ทดสอบว่า combinedKey derive ได้จริง — readiness check ก่อนสร้าง booklets
     */
    async validateEncryptionReady(campaignId: number) {
        const combined = await campaignKeyService.getCombinedKey(campaignId);
        combined.fill(0);
        return {
            success: true,
            message: "คีย์พร้อมใช้งาน — สามารถสร้าง QR payload ได้",
        };
    },

    /**
     * ตรวจว่า MK ที่ผู้จัดการให้มาตรงกับที่เก็บใน DB (constant-time compare)
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
