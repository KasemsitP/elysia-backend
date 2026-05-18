import { prisma } from "../../cores/prisma";

type ScanLogFilter = {
    campaignId?: number;
    sessionId?: number;
    bagId?: number;
    bookletId?: number;
    scanContext?: string;
    scanResult?: string;
    scannedByAccountId?: number;
    scannedByGraderId?: number;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
};

async function queryLogs(filter: ScanLogFilter) {
    const page = filter.page ?? 1;
    const take = filter.limit ?? 30;
    const skip = (page - 1) * take;

    const where = {
        ...(filter.campaignId !== undefined && { campaign_id: filter.campaignId }),
        ...(filter.sessionId !== undefined && { session_id: filter.sessionId }),
        ...(filter.bagId !== undefined && { bag_id: filter.bagId }),
        ...(filter.bookletId !== undefined && { booklet_id: filter.bookletId }),
        ...(filter.scanContext && { scan_context: filter.scanContext }),
        ...(filter.scanResult && { scan_result: filter.scanResult }),
        ...(filter.scannedByAccountId !== undefined && { scanned_by_account_id: filter.scannedByAccountId }),
        ...(filter.scannedByGraderId !== undefined && { scanned_by_grader_id: filter.scannedByGraderId }),
        ...((filter.dateFrom || filter.dateTo) && {
            scanned_at: {
                ...(filter.dateFrom && { gte: new Date(filter.dateFrom) }),
                ...(filter.dateTo && { lte: new Date(filter.dateTo) }),
            },
        }),
    };

    const [rows, total] = await Promise.all([
        prisma.qr_scan_logs.findMany({
            where,
            skip,
            take,
            orderBy: { scanned_at: "desc" },
            select: {
                id: true,
                campaign_id: true,
                session_id: true,
                bag_id: true,
                booklet_id: true,
                scan_context: true,
                scan_result: true,
                // ห้าม return plaintext payload — แค่ masked + hash
                qr_payload_masked: true,
                qr_payload_hash: true,
                error_code: true,
                error_message: true,
                scanned_at: true,
                accounts: { select: { id: true, full_name: true, username: true } },
                graders: { select: { id: true, account_id: true } },
            },
        }),
        prisma.qr_scan_logs.count({ where }),
    ]);

    return { data: rows, meta: { total, page, limit: take } };
}

export const scanLogService = {
    async findAll(filter: ScanLogFilter) {
        const result = await queryLogs(filter);
        return { success: true, message: "ดึง scan logs สำเร็จ", ...result };
    },

    async findByCampaign(campaignId: number, filter: Omit<ScanLogFilter, "campaignId">) {
        const result = await queryLogs({ ...filter, campaignId });
        return { success: true, message: "ดึง scan logs สำเร็จ", ...result };
    },

    async findByBooklet(bookletId: number, filter: Omit<ScanLogFilter, "bookletId">) {
        const result = await queryLogs({ ...filter, bookletId });
        return { success: true, message: "ดึง scan logs สำเร็จ", ...result };
    },

    async findByBag(bagId: number, filter: Omit<ScanLogFilter, "bagId">) {
        const result = await queryLogs({ ...filter, bagId });
        return { success: true, message: "ดึง scan logs สำเร็จ", ...result };
    },
};
