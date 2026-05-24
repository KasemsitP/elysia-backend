import { prisma, type Tx } from "../../cores/prisma";
import type { CreateUserBody, UpdateUserBody } from "./users.type";

export const userRepo = {
    async findAll(search?: string, skip = 0, take = 20, tx?: Tx) {
        const client = tx ?? prisma;
        const where = {
            deleted_at: null,
            ...(search && {
                OR: [
                    { user_code: { contains: search } },
                    { full_name: { contains: search } },
                    { national_id: { contains: search } },
                    { email: { contains: search } },
                ],
            }),
        };
        const [data, total] = await Promise.all([
            client.users.findMany({ where, skip, take, orderBy: { user_code: "asc" } }),
            client.users.count({ where }),
        ]);
        return { data, total };
    },

    async findById(id: number, tx?: Tx) {
        const client = tx ?? prisma;
        return client.users.findFirst({ where: { id, deleted_at: null } });
    },

    async findByCode(user_code: string, tx?: Tx) {
        const client = tx ?? prisma;
        return client.users.findFirst({ where: { user_code, deleted_at: null } });
    },

    async create(data: CreateUserBody, tx?: Tx) {
        const client = tx ?? prisma;
        return client.users.create({
            data: {
                user_code: data.user_code,
                full_name: data.full_name,
                title: data.title ?? null,
                gender: data.gender ?? null,
                first_name: data.first_name ?? null,
                last_name: data.last_name ?? null,
                first_name_en: data.first_name_en ?? null,
                last_name_en: data.last_name_en ?? null,
                national_id: data.national_id ?? null,
                birth_date: (() => { const d = data.birth_date ? new Date(data.birth_date) : null; return d && !isNaN(d.getTime()) ? d : null; })(),
                email: data.email ?? null,
                phone: data.phone ?? null,
                mobile: data.mobile ?? null,
                address: data.address ?? null,
                study_degree: data.study_degree ?? null,
                university: data.university ?? null,
                ethnicity: data.ethnicity ?? null,
                nationality_birth: data.nationality_birth ?? null,
                nationality_current: data.nationality_current ?? null,
                religion: data.religion ?? null,
            },
        });
    },

    async update(id: number, data: UpdateUserBody, tx?: Tx) {
        const client = tx ?? prisma;
        return client.users.update({
            where: { id },
            data: {
                ...(data.full_name !== undefined && { full_name: data.full_name }),
                ...(data.title !== undefined && { title: data.title }),
                ...(data.gender !== undefined && { gender: data.gender }),
                ...(data.first_name !== undefined && { first_name: data.first_name }),
                ...(data.last_name !== undefined && { last_name: data.last_name }),
                ...(data.first_name_en !== undefined && { first_name_en: data.first_name_en }),
                ...(data.last_name_en !== undefined && { last_name_en: data.last_name_en }),
                ...(data.national_id !== undefined && { national_id: data.national_id }),
                ...(data.birth_date !== undefined && { birth_date: data.birth_date ? new Date(data.birth_date) : null }),
                ...(data.email !== undefined && { email: data.email }),
                ...(data.phone !== undefined && { phone: data.phone }),
                ...(data.mobile !== undefined && { mobile: data.mobile }),
                ...(data.address !== undefined && { address: data.address }),
                ...(data.study_degree !== undefined && { study_degree: data.study_degree }),
                ...(data.university !== undefined && { university: data.university }),
            },
        });
    },

    async softDelete(id: number, tx?: Tx) {
        const client = tx ?? prisma;
        return client.users.update({ where: { id }, data: { deleted_at: new Date() } });
    },
};
