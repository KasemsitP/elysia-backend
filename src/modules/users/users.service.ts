import { userRepo } from "./users.repo";
import { AppError } from "../../cores/errors";
import { prisma } from "../../cores/prisma";
import type { CreateUserBody, UpdateUserBody, UserQuery, ImportUsersBody } from "./users.type";

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
        const dup = await userRepo.findByCode(input.user_code);
        if (dup) throw new AppError(`user_code "${input.user_code}" มีอยู่แล้ว`, 409);
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

    // Bulk import — skip duplicates, report results
    async import(input: ImportUsersBody) {
        const results = { created: 0, skipped: 0, errors: [] as string[] };

        await prisma.$transaction(async (tx) => {
            for (const user of input.users) {
                const dup = await userRepo.findByCode(user.user_code, tx);
                if (dup) {
                    results.skipped++;
                    continue;
                }
                try {
                    await userRepo.create(user, tx);
                    results.created++;
                } catch {
                    results.errors.push(user.user_code);
                }
            }
        });

        return { success: true, message: "นำเข้าข้อมูลผู้สอบสำเร็จ", data: results };
    },
};
