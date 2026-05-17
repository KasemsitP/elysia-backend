import { prisma, type Tx } from "../../cores/prisma";

export const graderRepo = {
    async findByCampaign(campaign_id: number, tx?: Tx) {
        const client = tx ?? prisma;
        return client.graders.findMany({
            where: { campaign_id, deleted_at: null },
            include: {
                accounts: {
                    select: { id: true, username: true, full_name: true, email: true, role_id: true, active: true },
                },
            },
            orderBy: { id: "asc" },
        });
    },

    async findById(id: number, tx?: Tx) {
        const client = tx ?? prisma;
        return client.graders.findFirst({
            where: { id, deleted_at: null },
            include: {
                accounts: {
                    select: { id: true, username: true, full_name: true, email: true, role_id: true, active: true },
                },
                grader_assignments: {
                    where: { deleted_at: null, active: true },
                    include: {
                        session_subject_questions: { select: { id: true, question_no: true, label: true } },
                    },
                },
            },
        });
    },

    async findByAccountAndCampaign(account_id: number, campaign_id: number, tx?: Tx) {
        const client = tx ?? prisma;
        return client.graders.findFirst({
            where: { account_id, campaign_id, deleted_at: null },
        });
    },

    async getGraderByAccountId(account_id: number, tx?: Tx) {
        const client = tx ?? prisma;
        return client.graders.findFirst({
            where: { account_id },
            select: { id: true, campaign_id: true, account_id: true },
        });
    },

    async create(account_id: number, campaign_id: number, tx?: Tx) {
        const client = tx ?? prisma;
        return client.graders.create({
            data: { account_id, campaign_id },
            include: {
                accounts: {
                    select: { id: true, username: true, full_name: true, email: true },
                },
            },
        });
    },

    // kept for auth.service.ts backward-compat
    async createGrader(account_id: number, campaign_id: number, tx?: Tx) {
        const client = tx ?? prisma;
        return client.graders.create({ data: { account_id, campaign_id } });
    },

    async update(id: number, active: boolean, tx?: Tx) {
        const client = tx ?? prisma;
        return client.graders.update({ where: { id }, data: { active } });
    },

    async softDelete(id: number, tx?: Tx) {
        const client = tx ?? prisma;
        return client.graders.update({
            where: { id },
            data: { deleted_at: new Date() },
        });
    },
};
