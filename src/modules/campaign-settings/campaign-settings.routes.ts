import { Elysia } from "elysia";
import { campaignSettingService } from "./campaign-settings.service";
import { requireSession } from "../../cores/session";
import { requireAdminOrManager } from "../../cores/auth-guard";
import {
    settingCampaignParamSchema,
    settingKeyParamSchema,
    createSettingBodySchema,
    updateSettingBodySchema,
} from "./campaign-settings.schema";

export const campaignSettingRoutes = new Elysia()
    .use(requireSession)
    // ── Read (authenticated) ─────────────────────────────────────────────────
    .get(
        "/setting-definitions",
        ({ set }) => {
            set.status = 200;
            return campaignSettingService.findDefinitions();
        },
    )
    .get(
        "/campaigns/:campaignId/settings",
        ({ params, set }) => {
            set.status = 200;
            return campaignSettingService.findAll(params.campaignId);
        },
        { params: settingCampaignParamSchema },
    )
    .get(
        "/campaigns/:campaignId/settings/:key",
        ({ params, set }) => {
            set.status = 200;
            return campaignSettingService.findByKey(params.campaignId, params.key);
        },
        { params: settingKeyParamSchema },
    )
    // ── Write (ADMIN or MANAGER only) ────────────────────────────────────────
    .use(requireAdminOrManager())
    .post(
        "/campaigns/:campaignId/settings",
        ({ params, body, session, set }) => {
            set.status = 201;
            return campaignSettingService.create(params.campaignId, body, session);
        },
        { params: settingCampaignParamSchema, body: createSettingBodySchema },
    )
    .patch(
        "/campaigns/:campaignId/settings/:key",
        ({ params, body, session, set }) => {
            set.status = 200;
            return campaignSettingService.update(params.campaignId, params.key, body, session);
        },
        { params: settingKeyParamSchema, body: updateSettingBodySchema },
    )
    .delete(
        "/campaigns/:campaignId/settings/:key",
        ({ params, set }) => {
            set.status = 200;
            return campaignSettingService.delete(params.campaignId, params.key);
        },
        { params: settingKeyParamSchema },
    );
