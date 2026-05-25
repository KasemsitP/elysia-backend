import { prisma, type Tx } from "../../cores/prisma";

export const bagRepo = {
    async findByCampaign(campaign_id: number, tx?: Tx) {
        const client = tx ?? prisma;
        return client.bags.findMany({
            where: { campaign_id, deleted_at: null },
            orderBy: [{ session_id: "asc" }, { bag_no: "asc" }],
        });
    },

    async findByCampaignAndSession(campaign_id: number, session_id: number, tx?: Tx) {
        const client = tx ?? prisma;
        return client.bags.findMany({
            where: { campaign_id, session_id, deleted_at: null },
            orderBy: { bag_no: "asc" },
        });
    },

    async findById(id: number, tx?: Tx) {
        const client = tx ?? prisma;
        return client.bags.findFirst({
            where: { id, deleted_at: null },
            include: {
                sessions: { select: { id: true, session_code: true, day_no: true } },
                exam_campaigns: { select: { id: true, name: true, year_be: true } },
                accounts: { select: { id: true, full_name: true } },
            },
        });
    },

    async findBookletsInBag(bag_id: number, tx?: Tx) {
        const client = tx ?? prisma;
        return client.booklets.findMany({
            where: { bag_id, deleted_at: null },
            orderBy: { seq_in_bag: "asc" },
            // ห้าม select qr_payload ออกไปตรงๆ
            select: {
                id: true,
                campaign_id: true,
                session_id: true,
                user_code: true,
                bag_id: true,
                seq_in_bag: true,
                random_num: true,
                status: true,
                created_at: true,
            },
        });
    },

    async create(
        data: {
            campaign_id: number;
            session_id: number;
            bag_no: number;
            count_items: number;
            created_by_account_id: number;
        },
        tx?: Tx,
    ) {
        const client = tx ?? prisma;
        return client.bags.create({ data });
    },

    async updateStatus(id: number, status: string, tx?: Tx) {
        const client = tx ?? prisma;
        return client.bags.update({ where: { id }, data: { status } });
    },

    async softDelete(id: number, tx?: Tx) {
        const client = tx ?? prisma;
        return client.bags.update({
            where: { id },
            data: { deleted_at: new Date() },
        });
    },

    // หาเลขถุงถัดไป — ดึง gap แรกที่หายไป เช่น มี 1,3 → คืน 2
    async getNextBagNo(session_id: number, tx?: Tx): Promise<number> {
        const client = tx ?? prisma;
        const bags = await client.bags.findMany({
            where:   { session_id, deleted_at: null },
            select:  { bag_no: true },
            orderBy: { bag_no: "asc" },
        });
        const used = new Set(bags.map((b) => b.bag_no));
        let next = 1;
        while (used.has(next)) next++;
        return next;
    },

    // SELECT ... FOR UPDATE — ต้องอยู่ใน transaction เสมอ
    async lockAndGetCounter(session_id: number, tx: Tx) {
        const rows = await tx.$queryRaw<
            Array<{ next_bag_no: number; next_random_seq: number }>
        >`SELECT next_bag_no, next_random_seq FROM session_counters WHERE session_id = ${session_id} FOR UPDATE`;
        return rows[0] ?? null;
    },

    async upsertCounter(session_id: number, tx: Tx) {
        return tx.session_counters.upsert({
            where: { session_id },
            create: { session_id, next_bag_no: 1, next_random_seq: 1 },
            update: {},
        });
    },

    async incrementCounter(session_id: number, booklet_count: number, tx: Tx) {
        return tx.session_counters.update({
            where: { session_id },
            data: { next_random_seq: { increment: booklet_count } },
        });
    },
};
