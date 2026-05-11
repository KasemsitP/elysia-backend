import { prisma } from "../../cores/prisma";
import { serializeBigInt } from "../../cores/bigint";

export const authRepo = {
    async findAccountByUsername(username: string) {
        const account = await prisma.accounts.findUnique({ where: { username } });
        return account ? serializeBigInt(account) : null;
    },

    async findAccountById(accountId: string) {
        const account = await prisma.accounts.findUnique({
            where: { id: BigInt(accountId) },
            include: {
                roles: {
                    select: {
                        id: true,
                        name: true
                    }
                }
            }
        });
        return account ? serializeBigInt(account) : null;
    },

    async createAccount(data: {
        username: string;
        password_hash: string;
        full_name: string;
        email?: string;
        role_id: number;
        manager_order: number | null;
        title: string;
        campaign_id: number | null;
    }) {
        const account = await prisma.accounts.create({
            data: {
                username: data.username,
                password_hash: data.password_hash,
                full_name: data.full_name,
                email: data.email ?? null,
                role_id: BigInt(data.role_id),
                manager_order: data.manager_order ?? null,
                title: data.title,
                campaign_id: data.campaign_id

            },
        });
        return serializeBigInt(account);
    },

    updatePassword(accountId: string, password_hash: string) {
        return prisma.accounts.update({
            where: { id: BigInt(accountId) },
            data: { password_hash },
        });
    },

    async revokeAccount(accountId: string) {
        await prisma.accounts.update({
            where: { id: BigInt(accountId) },
            data: { active: false },
        });
    },
    async unRevokeAccount(accountId: string) {
        await prisma.accounts.update({
            where: { id: BigInt(accountId) },
            data: { active: true },
        });
    },
}