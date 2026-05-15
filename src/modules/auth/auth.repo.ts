import { prisma, type Tx } from "../../cores/prisma";

export const authRepo = {
    async findAccountByUsername(username: string) {
        const account = await prisma.accounts.findFirst({
            where: {
                username,
                deleted_at: null,
            }
        });
        return account ? account : null;
    },

    async findAccountById(accountId: string) {
        const account = await prisma.accounts.findUnique({
            where: { id: Number(accountId) },
            include: {
                roles: {
                    select: {
                        id: true,
                        name: true
                    }
                }
            }
        });
        return account ? account : null;
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
    }, tx?: Tx) {
        const client = tx ?? prisma;
        const account = await client.accounts.create({
            data: {
                username: data.username,
                password_hash: data.password_hash,
                full_name: data.full_name,
                email: data.email ?? null,
                role_id: Number(data.role_id),
                manager_order: data.manager_order ?? null,
                title: data.title,
                campaign_id: data.campaign_id

            },
        });
        return account;
    },

    updatePassword(accountId: string, password_hash: string) {
        return prisma.accounts.update({
            where: { id: Number(accountId) },
            data: { password_hash },
        });
    },

    async revokeAccount(accountId: string) {
        await prisma.accounts.update({
            where: { id: Number(accountId) },
            data: { active: false },
        });
    },
    async unRevokeAccount(accountId: string) {
        await prisma.accounts.update({
            where: { id: Number(accountId) },
            data: { active: true },
        });
    },
}