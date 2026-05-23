import { t } from "elysia";

export const bookletCampaignParamSchema = t.Object({
    campaignId: t.Numeric(),
});

export const bookletGenerateParamSchema = t.Object({
    campaignId: t.Numeric(),
    sessionId: t.Numeric(),
});

export const bookletIdParamSchema = t.Object({
    bookletId: t.Numeric(),
});

export const generateBookletsBodySchema = t.Object({
    // user_codes — เลขประจำตัวสอบ 1 ค่าต่อ 1 เล่ม (length = จำนวนเล่มที่จะสร้าง)
    user_codes: t.Array(t.String({ minLength: 1 }), { minItems: 1, maxItems: 10000 }),
    // Manager ทั้ง 2 ต้องให้ key เพื่อ unlock DEK ก่อน generate
    // key ไม่ถูกเก็บ — ใช้ derive KEK ในหน่วยความจำแล้วทิ้ง
    manager1_key: t.String({ minLength: 8 }),
    manager2_key: t.String({ minLength: 8 }),
});

export const updateBookletBodySchema = t.Object({
    status: t.Optional(t.String()),
    user_code: t.Optional(t.Nullable(t.String())),
});

export const bookletQuerySchema = t.Object({
    session_id: t.Optional(t.Numeric()),
    status: t.Optional(t.String()),
    page: t.Optional(t.Numeric()),
    limit: t.Optional(t.Numeric()),
});
