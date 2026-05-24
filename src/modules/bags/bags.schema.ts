import { t } from "elysia";

export const bagCampaignParamSchema = t.Object({
    campaignId: t.Numeric(),
});

export const bagCampaignSessionParamSchema = t.Object({
    campaignId: t.Numeric(),
    sessionId: t.Numeric(),
});

export const bagIdParamSchema = t.Object({
    bagId: t.Numeric(),
});

// Preview: ส่ง qr_payloads มาให้ตรวจว่า booklet ทั้งหมด valid ก่อนสร้างถุง
export const scanPreviewBodySchema = t.Object({
    campaign_id: t.Number(),
    qr_payloads: t.Array(t.String(), { minItems: 1 }),
});

// Create bag: สร้างถุงจาก qr_payloads ที่ผ่าน preview แล้ว
export const createBagBodySchema = t.Object({
    campaign_id: t.Number(),
    qr_payloads: t.Array(t.String(), { minItems: 1 }),
});

export const updateBagStatusBodySchema = t.Object({
    status: t.Union([
        t.Literal("CREATED"),
        t.Literal("GRADING"),
        t.Literal("COMPLETED"),
        t.Literal("RETURNED"),
    ]),
});
