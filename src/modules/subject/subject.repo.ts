import { prisma, type Tx } from "../../cores/prisma";
import type { CreateSubjectBody, UpdateSubjectBody } from "./subject.type";

export const subjectRepo = {
    async findAll(tx?: Tx) {
        const client = tx ?? prisma;
        return client.subjects.findMany({
            where: { deleted_at: null },
            orderBy: { code: "asc" },
        });
    },

    async findById(id: number, tx?: Tx) {
        const client = tx ?? prisma;
        return client.subjects.findFirst({
            where: { id, deleted_at: null },
        });
    },

    async existsByCode(code: string, excludeId?: number, tx?: Tx) {
        const client = tx ?? prisma;
        return client.subjects.findFirst({
            where: {
                code,
                deleted_at: null,
                ...(excludeId !== undefined && { id: { not: excludeId } }),
            },
        });
    },

    async create(data: CreateSubjectBody, tx?: Tx) {
        const client = tx ?? prisma;
        return client.subjects.create({
            data: {
                code: data.code,
                name: data.name,
                full_score: data.full_score ?? 0,
                active: data.active ?? true,
            },
        });
    },

    async update(id: number, data: UpdateSubjectBody, tx?: Tx) {
        const client = tx ?? prisma;
        return client.subjects.update({
            where: { id },
            data: {
                ...(data.code !== undefined && { code: data.code }),
                ...(data.name !== undefined && { name: data.name }),
                ...(data.full_score !== undefined && { full_score: data.full_score }),
                ...(data.active !== undefined && { active: data.active }),
            },
        });
    },

    async softDelete(id: number, tx?: Tx) {
        const client = tx ?? prisma;
        return client.subjects.update({
            where: { id },
            data: { deleted_at: new Date() },
        });
    },
};
