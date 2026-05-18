import { Elysia, t } from "elysia";
import { requireAdminOrManager } from "../../cores/auth-guard";
import { campaignKeyService } from "./campaign-keys.service";

const campaignIdParam = t.Object({ campaignId: t.Numeric() });

// Body สำหรับ setup/rotate — manager ต้องให้ key ของตัวเอง
const setupKeysBody = t.Object({
    manager1_account_id: t.Number(),
    manager1_key: t.String({ minLength: 8 }),
    manager2_account_id: t.Number(),
    manager2_key: t.String({ minLength: 8 }),
});

const verifyKeysBody = t.Object({
    manager1_key: t.String(),
    manager2_key: t.String(),
});

export const campaignKeyRoutes = new Elysia({ prefix: "/campaigns/:campaignId/keys" })
    .use(requireAdminOrManager())
    // ดูสถานะ keys (ไม่แสดง hash/plaintext)
    .get(
        "/",
        ({ params, set }) => {
            set.status = 200;
            return campaignKeyService.getKeyStatus(params.campaignId);
        },
        { params: campaignIdParam },
    )
    // Setup keys ครั้งแรก — Manager ทั้ง 2 ให้ key พร้อมกัน
    .post(
        "/setup",
        ({ params, body, set }) => {
            set.status = 201;
            return campaignKeyService.setupKeys(
                params.campaignId,
                body.manager1_account_id,
                body.manager1_key,
                body.manager2_account_id,
                body.manager2_key,
            );
        },
        { params: campaignIdParam, body: setupKeysBody },
    )
    // Verify keys — ตรวจว่า key ถูกต้องโดยไม่ทำอะไรเพิ่ม
    .post(
        "/verify",
        ({ params, body, set }) => {
            set.status = 200;
            return campaignKeyService.verifyKeys(
                params.campaignId,
                body.manager1_key,
                body.manager2_key,
            );
        },
        { params: campaignIdParam, body: verifyKeysBody },
    )
    // Rotate keys — เปลี่ยน key ทั้งชุด (DEK ใหม่, KEK ใหม่)
    .post(
        "/rotate",
        ({ params, body, set }) => {
            set.status = 200;
            return campaignKeyService.rotateKeys(
                params.campaignId,
                body.manager1_account_id,
                body.manager1_key,
                body.manager2_account_id,
                body.manager2_key,
            );
        },
        { params: campaignIdParam, body: setupKeysBody },
    );
