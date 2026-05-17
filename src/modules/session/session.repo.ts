import { prisma, type Tx } from "../../cores/prisma";
import type { sessionCreateBodySchema } from "./session.type";

export const sessionRepo = {


    async findAllSession(tx?: Tx) {
        const client = tx ?? prisma;
        return await client.sessions.findMany();


    },

    async findSessionByCampaign(campaign_id: number, tx?: Tx) {
        const client = tx ?? prisma;
        return await client.sessions.findFirst({ where: { campaign_id: campaign_id } });
    },

    async findSessionById(session_id: number, tx?: Tx) {
        const client = tx ?? prisma;
        return await client.sessions.findMany({ where: { id: session_id } });
    },

    async findCampaignById(id: number, tx?: Tx) {
        const client = tx ?? prisma;
        return await client.exam_campaigns.findUnique({ where: { id } });
    },

    async sessionCreate(data: sessionCreateBodySchema, tx?: Tx) {
        const client = tx ?? prisma;
        return await client.sessions.create({ data });
    }
}