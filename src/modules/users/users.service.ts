import { userRepo } from "./users.repo";
import { AppError } from "../../cores/errors";
import { prisma } from "../../cores/prisma";
import type { CreateUserBody, UpdateUserBody, UserQuery, ImportUsersSeqBody } from "./users.type";

export const userService = {
    async findAll(query: UserQuery) {
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        const { data, total } = await userRepo.findAll(query.search, (page - 1) * limit, limit);
        return { success: true, message: "ดึงข้อมูลผู้สอบสำเร็จ", data, meta: { total, page, limit } };
    },

    async findById(userId: number) {
        const data = await userRepo.findById(userId);
        if (!data) throw new AppError("ไม่พบผู้สอบ", 404);
        return { success: true, message: "ดึงข้อมูลผู้สอบสำเร็จ", data };
    },

    async create(input: CreateUserBody) {
        const data = await userRepo.create(input);
        return { success: true, message: "สร้างผู้สอบสำเร็จ", data };
    },

    async update(userId: number, input: UpdateUserBody) {
        const user = await userRepo.findById(userId);
        if (!user) throw new AppError("ไม่พบผู้สอบ", 404);
        const data = await userRepo.update(userId, input);
        return { success: true, message: "อัปเดตผู้สอบสำเร็จ", data };
    },

    async delete(userId: number) {
        const user = await userRepo.findById(userId);
        if (!user) throw new AppError("ไม่พบผู้สอบ", 404);
        await userRepo.softDelete(userId);
        return { success: true, message: "ลบผู้สอบสำเร็จ" };
    },

    // Import แบบ auto-generate user_code ตามลำดับ ต่อจาก max ที่มีอยู่
    async importSequential(input: ImportUsersSeqBody) {
        const { campaign_id, users } = input;

        const campaign = await prisma.exam_campaigns.findFirst({
            where: { id: campaign_id, deleted_at: null },
        });
        if (!campaign) throw new AppError("ไม่พบรอบสอบ", 404);

        const sessions = await prisma.sessions.findMany({
            where:  { campaign_id, deleted_at: null },
            select: { id: true },
        });
        if (sessions.length === 0) throw new AppError("ยังไม่มีวันสอบในรอบสอบนี้ กรุณาสร้างวันสอบก่อน import ผู้สอบ", 400);
        const sessionIds = sessions.map((s) => s.id);

        // หา max numeric user_code ใน campaign นี้ (รวม deleted เพื่อกัน code ซ้ำ)
        const [row] = await prisma.$queryRaw<[{ max_code: bigint | null }]>`
            SELECT MAX(CAST(u.user_code AS UNSIGNED)) AS max_code
            FROM users u
            INNER JOIN user_campaigns uc ON uc.user_id = u.id AND uc.campaign_id = ${campaign_id}
            WHERE u.user_code REGEXP '^[0-9]+$'
        `;
        let nextCode = Number(row?.max_code ?? 0) + 1;

        // ดึง national_id ที่มีอยู่ใน campaign นั้นแล้ว
        const existingInCampaign = await prisma.user_campaigns.findMany({
            where:   { campaign_id, deleted_at: null },
            include: { users: { select: { national_id: true } } },
        });
        const existingNationalIds = new Set<string>(
            existingInCampaign
                .map((uc) => uc.users?.national_id)
                .filter((id): id is string => !!id),
        );

        const results = {
            created:  0,
            skipped:  0,
            errors:   [] as string[],
            assigned: [] as { user_code: string; full_name: string }[],
        };

        for (const user of users) {
            // ข้ามถ้า national_id ซ้ำใน campaign
            if (user.national_id && existingNationalIds.has(user.national_id)) {
                results.skipped++;
                continue;
            }

            const user_code = String(nextCode); // ยังไม่ increment
            try {
                const created = await prisma.$transaction(async (tx) => {
                    const u = await userRepo.create({ ...user, user_code }, tx);
                    const uc = await tx.user_campaigns.create({
                        data: { user_id: u.id, campaign_id },
                    });
                    await tx.user_sessions.createMany({
                        data: sessionIds.map((session_id) => ({
                            user_campaign_id: uc.id,
                            campaign_id,
                            session_id,
                        })),
                    });
                    return u;
                });
                nextCode++; // increment เฉพาะเมื่อสำเร็จ → ไม่มี gap
                results.created++;
                results.assigned.push({ user_code, full_name: created.full_name });
                if (user.national_id) existingNationalIds.add(user.national_id);
            } catch (err) {
                const reason = err instanceof Error ? err.message : String(err);
                console.error(`[import] สร้างผู้สอบล้มเหลว user_code=${user_code} name=${user.full_name}:`, reason);
                results.errors.push(`${user.full_name} (user_code=${user_code}): ${reason}`);
                // ไม่ increment — code นี้ยังไม่ถูกใช้
            }
        }

        return {
            success: true,
            message: `นำเข้าข้อมูลผู้สอบสำเร็จ สร้าง ${results.created} คน`,
            data:    results,
        };
    },
};
