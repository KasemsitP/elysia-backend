import { prisma } from "../../cores/prisma";
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
    }





}