import { prisma, type Tx } from "../../cores/prisma";







export const graderRepo = {
    async getGraderByAccountId(account_id: number) {
        const grader = await prisma.graders.findFirst({
            where: { account_id: account_id },
            select: {
                id: true,
                campaign_id: true,
                account_id: true
            }
        });
        return grader ?? null;
    },

    async createGrader(account_id: number, campaign_id: number | null, tx?: Tx) {
        const client = tx ?? prisma;
        const grader = await client.graders.create({
            data: {
                account_id: account_id,
                campaign_id: campaign_id,
            },
        });
        return grader;
    }





}