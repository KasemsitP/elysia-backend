import { campaignSettingRepo } from "./campaign-settings.repo";
import { campaignRepo } from "../campaign/campaign.repo";
import { AppError } from "../../cores/errors";
import type { CreateSettingBody, UpdateSettingBody, ValueType } from "./campaign-settings.type";
import type { SessionData } from "../auth/auth.type";

const VALID_TYPES: ValueType[] = ["STRING", "NUMBER", "BOOLEAN", "JSON", "DATE"];

function inferValueType(value: unknown): ValueType {
    if (typeof value === "boolean") return "BOOLEAN";
    if (typeof value === "number") return "NUMBER";
    if (typeof value === "string") {
        if (!isNaN(Date.parse(value)) && value.includes("-")) return "DATE";
        return "STRING";
    }
    return "JSON";
}

function validateValue(value: unknown, type: ValueType): boolean {
    switch (type) {
        case "STRING":  return typeof value === "string";
        case "NUMBER":  return typeof value === "number" && Number.isFinite(value);
        case "BOOLEAN": return typeof value === "boolean";
        case "DATE":    return typeof value === "string" && !isNaN(Date.parse(value));
        case "JSON":    return typeof value === "object" && value !== null;
    }
}

export const campaignSettingService = {
    async findAll(campaignId: number) {
        const campaign = await campaignRepo.findById(campaignId);
        if (!campaign) throw new AppError("ไม่พบรอบสอบ", 404);
        const data = await campaignSettingRepo.findAll(campaignId);
        return { success: true, message: "ดึงข้อมูล settings สำเร็จ", data };
    },

    async findByKey(campaignId: number, key: string) {
        const data = await campaignSettingRepo.findByKey(campaignId, key);
        if (!data) throw new AppError(`ไม่พบ setting: ${key}`, 404);
        return { success: true, message: "ดึงข้อมูล setting สำเร็จ", data };
    },

    async findDefinitions() {
        const data = await campaignSettingRepo.findAllDefinitions();
        return { success: true, message: "ดึงข้อมูล setting definitions สำเร็จ", data };
    },

    async create(campaignId: number, input: CreateSettingBody, session: SessionData) {
        const campaign = await campaignRepo.findById(campaignId);
        if (!campaign) throw new AppError("ไม่พบรอบสอบ", 404);

        // ตรวจ duplicate
        const existing = await campaignSettingRepo.findByKey(campaignId, input.setting_key);
        if (existing) throw new AppError(`setting_key "${input.setting_key}" มีอยู่แล้ว`, 409);

        // ถ้ามี definition → ตรวจ value_type
        const definition = await campaignSettingRepo.findDefinition(input.setting_key);

        const valueType: ValueType = (() => {
            if (input.value_type) return input.value_type;
            if (definition?.value_type && VALID_TYPES.includes(definition.value_type as ValueType)) {
                return definition.value_type as ValueType;
            }
            return inferValueType(input.setting_value);
        })();

        if (!validateValue(input.setting_value, valueType)) {
            throw new AppError(`setting_value ไม่ตรงกับ value_type "${valueType}"`, 400);
        }

        const data = await campaignSettingRepo.create(
            campaignId,
            {
                setting_key: input.setting_key,
                setting_value: input.setting_value,
                value_type: valueType,
                description: input.description ?? definition?.description ?? null,
            },
            session.account_id,
        );
        return { success: true, message: "สร้าง setting สำเร็จ", data };
    },

    async update(campaignId: number, key: string, input: UpdateSettingBody, session: SessionData) {
        const existing = await campaignSettingRepo.findByKey(campaignId, key);
        if (!existing) throw new AppError(`ไม่พบ setting: ${key}`, 404);

        const valueType = (input.value_type ?? existing.value_type) as ValueType;

        if (input.setting_value !== undefined && !validateValue(input.setting_value, valueType)) {
            throw new AppError(`setting_value ไม่ตรงกับ value_type "${valueType}"`, 400);
        }

        const data = await campaignSettingRepo.update(
            campaignId,
            key,
            {
                ...(input.setting_value !== undefined && { setting_value: input.setting_value }),
                ...(input.value_type !== undefined && { value_type: input.value_type }),
                ...(input.description !== undefined && { description: input.description }),
                ...(input.active !== undefined && { active: input.active }),
            },
            session.account_id,
        );
        return { success: true, message: "อัปเดต setting สำเร็จ", data };
    },

    async delete(campaignId: number, key: string) {
        const existing = await campaignSettingRepo.findByKey(campaignId, key);
        if (!existing) throw new AppError(`ไม่พบ setting: ${key}`, 404);
        await campaignSettingRepo.softDelete(campaignId, key);
        return { success: true, message: "ลบ setting สำเร็จ" };
    },
};
