import { prisma, type Tx } from "../../cores/prisma";

export const bookletRepo = {
    async findByCampaign(campaign_id: number, session_id?: number, status?: string, tx?: Tx) {
        const client = tx ?? prisma;
        return client.booklets.findMany({
            where: {
                campaign_id,
                deleted_at: null,
                ...(session_id !== undefined && { session_id }),
                ...(status !== undefined && { status }),
            },
            orderBy: [{ session_id: "asc" }, { id: "asc" }],
        });
    },

    async findById(id: number, tx?: Tx) {
        const client = tx ?? prisma;
        return client.booklets.findFirst({
            where: { id, deleted_at: null },
        });
    },

    async findByQrPayload(qr_payload: string, tx?: Tx) {
        const client = tx ?? prisma;
        return client.booklets.findFirst({
            where: { qr_payload, deleted_at: null },
        });
    },

    async createMany(
        records: Array<{
            campaign_id: number;
            session_id: number;
            qr_payload: string;
        }>,
        tx?: Tx,
    ) {
        const client = tx ?? prisma;
        return client.booklets.createMany({ data: records, skipDuplicates: true });
    },

    async findBySession(campaign_id: number, session_id: number, tx?: Tx) {
        const client = tx ?? prisma;
        return client.booklets.findMany({
            where: { campaign_id, session_id, deleted_at: null },
            orderBy: { id: "asc" },
        });
    },

    async update(id: number, data: { status?: string; user_code?: string | null }, tx?: Tx) {
        const client = tx ?? prisma;
        return client.booklets.update({ where: { id }, data });
    },

    async softDelete(id: number, tx?: Tx) {
        const client = tx ?? prisma;
        return client.booklets.update({
            where: { id },
            data: { deleted_at: new Date() },
        });
    },

    async countBySession(campaign_id: number, session_id: number, tx?: Tx) {
        const client = tx ?? prisma;
        return client.booklets.count({ where: { campaign_id, session_id, deleted_at: null } });
    },
};
