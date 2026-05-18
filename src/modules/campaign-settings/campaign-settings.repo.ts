import { prisma, type Tx } from "../../cores/prisma";
import type { ValueType } from "./campaign-settings.type";

export const campaignSettingRepo = {
    async findAll(campaign_id: number, tx?: Tx) {
        const client = tx ?? prisma;
        return client.campaign_settings.findMany({
            where: { campaign_id, deleted_at: null },
            orderBy: { setting_key: "asc" },
        });
    },

    async findByKey(campaign_id: number, setting_key: string, tx?: Tx) {
        const client = tx ?? prisma;
        return client.campaign_settings.findFirst({
            where: { campaign_id, setting_key, deleted_at: null },
        });
    },

    async findDefinition(setting_key: string, tx?: Tx) {
        const client = tx ?? prisma;
        return client.setting_definitions.findFirst({
            where: { setting_key, active: true },
        });
    },

    async findAllDefinitions(tx?: Tx) {
        const client = tx ?? prisma;
        return client.setting_definitions.findMany({
            where: { active: true },
            orderBy: { setting_key: "asc" },
        });
    },

    async create(
        campaign_id: number,
        data: {
            setting_key: string;
            setting_value: unknown;
            value_type: ValueType;
            description: string | null;
        },
        created_by: number,
        tx?: Tx,
    ) {
        const client = tx ?? prisma;
        return client.campaign_settings.create({
            data: {
                campaign_id,
                setting_key: data.setting_key,
                // JSON roundtrip: ensures value is Prisma-compatible InputJsonValue
                setting_value: JSON.parse(JSON.stringify(data.setting_value)),
                value_type: data.value_type,
                description: data.description,
                created_by_account_id: created_by,
                updated_by_account_id: created_by,
                active: true,
            },
        });
    },

    async update(
        campaign_id: number,
        setting_key: string,
        data: { setting_value?: unknown; value_type?: ValueType; description?: string | null; active?: boolean },
        updated_by: number,
        tx?: Tx,
    ) {
        const client = tx ?? prisma;
        return client.campaign_settings.update({
            where: { campaign_id_setting_key: { campaign_id, setting_key } },
            data: {
                ...(data.setting_value !== undefined && {
                    setting_value: JSON.parse(JSON.stringify(data.setting_value)),
                }),
                ...(data.value_type !== undefined && { value_type: data.value_type }),
                ...(data.description !== undefined && { description: data.description }),
                ...(data.active !== undefined && { active: data.active }),
                updated_by_account_id: updated_by,
            },
        });
    },

    async softDelete(campaign_id: number, setting_key: string, tx?: Tx) {
        const client = tx ?? prisma;
        return client.campaign_settings.update({
            where: { campaign_id_setting_key: { campaign_id, setting_key } },
            data: { deleted_at: new Date() },
        });
    },
};
