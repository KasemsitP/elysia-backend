import { subjectRepo } from "./subject.repo";
import { AppError } from "../../cores/errors";
import type { CreateSubjectBody, UpdateSubjectBody } from "./subject.type";

export const subjectService = {
    async findAll() {
        const data = await subjectRepo.findAll();
        return { success: true, message: "ดึงข้อมูลวิชาสำเร็จ", data };
    },

    async findById(subjectId: number) {
        const data = await subjectRepo.findById(subjectId);
        if (!data) throw new AppError("ไม่พบวิชา", 404);
        return { success: true, message: "ดึงข้อมูลวิชาสำเร็จ", data };
    },

    async create(input: CreateSubjectBody) {
        const dup = await subjectRepo.existsByCode(input.code);
        if (dup) throw new AppError(`รหัสวิชา ${input.code} มีอยู่แล้ว`, 409);
        const data = await subjectRepo.create(input);
        return { success: true, message: "สร้างวิชาสำเร็จ", data };
    },

    async update(subjectId: number, input: UpdateSubjectBody) {
        const subject = await subjectRepo.findById(subjectId);
        if (!subject) throw new AppError("ไม่พบวิชา", 404);
        if (input.code !== undefined) {
            const dup = await subjectRepo.existsByCode(input.code, subjectId);
            if (dup) throw new AppError(`รหัสวิชา ${input.code} มีอยู่แล้ว`, 409);
        }
        const data = await subjectRepo.update(subjectId, input);
        return { success: true, message: "อัปเดตวิชาสำเร็จ", data };
    },

    async delete(subjectId: number) {
        const subject = await subjectRepo.findById(subjectId);
        if (!subject) throw new AppError("ไม่พบวิชา", 404);
        await subjectRepo.softDelete(subjectId);
        return { success: true, message: "ลบวิชาสำเร็จ" };
    },
};
