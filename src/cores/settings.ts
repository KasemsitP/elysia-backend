import { prisma } from "./prisma";

export function parseNumberSetting(value: unknown, fallback: number): number {
    if (typeof value === "number") return value;
    if (typeof value === "string") {
        const n = Number(value);
        return Number.isFinite(n) ? n : fallback;
    }
    return fallback;
}

export function parseBoolSetting(value: unknown, fallback: boolean): boolean {
    if (typeof value === "boolean") return value;
    if (typeof value === "string") return value === "true" || value === "1";
    return fallback;
}

export function parseStringSetting(value: unknown, fallback: string): string {
    if (typeof value === "string") return value;
    return fallback;
}

// Convenience: ดึง setting และ parse เป็น number ใน 1 call
export async function getNumberSetting(campaign_id: number, key: string, fallback: number): Promise<number> {
    const setting = await prisma.campaign_settings.findFirst({
        where: { campaign_id, setting_key: key, active: true, deleted_at: null },
    });
    return setting ? parseNumberSetting(setting.setting_value, fallback) : fallback;
}

export async function getStringSetting(campaign_id: number, key: string, fallback: string): Promise<string> {
    const setting = await prisma.campaign_settings.findFirst({
        where: { campaign_id, setting_key: key, active: true, deleted_at: null },
    });
    return setting ? parseStringSetting(setting.setting_value, fallback) : fallback;
}
