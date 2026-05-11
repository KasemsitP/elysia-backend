import { prisma, type Tx } from "../../cores/prisma";
import { serializeBigInt } from "../../cores/bigint";







export const graderRepo = {
    async getGraderByAccountId(account_id: string) {
        const grader = await prisma.graders.findFirst({
            where: { account_id: BigInt(account_id) },
            select: {
                id: true,
                campaign_id: true,
                account_id: true
            }
        });
        return grader ? serializeBigInt(grader) : null;
    },

    async createGrader(account_id: string, campaign_id: number | null, tx?: Tx) {
        const client = tx ?? prisma;
        const grader = await client.graders.create({
            data: {
                account_id: BigInt(account_id),
                campaign_id: campaign_id !== null ? BigInt(campaign_id) : null,
            },
        });
        return serializeBigInt(grader);
    }





}