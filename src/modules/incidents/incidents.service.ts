import { AppError } from "../../cores/errors";
import { prisma } from "../../cores/prisma";
import type {
    CreateIncidentBody,
    IncidentQuery,
    UpdateIncidentBody,
    UpdateIncidentStatusBody,
} from "./incidents.type";
import type { SessionData } from "../auth/auth.type";

export const incidentService = {
    async findAll(query: IncidentQuery) {
        const data = await prisma.booklet_incident_reports.findMany({
            where: {
                deleted_at: null,
                ...(query.campaign_id !== undefined && { campaign_id: query.campaign_id }),
                ...(query.session_id !== undefined && { session_id: query.session_id }),
                ...(query.status !== undefined && { status: query.status }),
            },
            orderBy: { created_at: "desc" },
        });
        return { success: true, message: "ดึงข้อมูลเหตุผิดปกติสำเร็จ", data };
    },

    async findById(incidentId: number) {
        const data = await prisma.booklet_incident_reports.findFirst({
            where: { id: incidentId, deleted_at: null },
            include: { incident_attachments: true },
        });
        if (!data) throw new AppError("ไม่พบรายงานเหตุผิดปกติ", 404);
        return { success: true, message: "ดึงข้อมูลสำเร็จ", data };
    },

    async create(input: CreateIncidentBody, session: SessionData) {
        const data = await prisma.booklet_incident_reports.create({
            data: {
                campaign_id: input.campaign_id,
                session_id: input.session_id,
                bag_id: input.bag_id ?? null,
                booklet_id: input.booklet_id ?? null,
                incident_type: input.incident_type,
                severity: input.severity ?? "MEDIUM",
                title: input.title,
                description: input.description,
                status: "OPEN",
                reported_by_account_id: session.account_id,
            },
        });
        return { success: true, message: "สร้างรายงานเหตุผิดปกติสำเร็จ", data };
    },

    async update(incidentId: number, input: UpdateIncidentBody) {
        const incident = await prisma.booklet_incident_reports.findFirst({
            where: { id: incidentId, deleted_at: null },
        });
        if (!incident) throw new AppError("ไม่พบรายงานเหตุผิดปกติ", 404);

        const data = await prisma.booklet_incident_reports.update({
            where: { id: incidentId },
            data: {
                ...(input.incident_type !== undefined && { incident_type: input.incident_type }),
                ...(input.severity !== undefined && { severity: input.severity }),
                ...(input.title !== undefined && { title: input.title }),
                ...(input.description !== undefined && { description: input.description }),
                ...(input.assigned_to_account_id !== undefined && {
                    assigned_to_account_id: input.assigned_to_account_id,
                }),
            },
        });
        return { success: true, message: "อัปเดตรายงานสำเร็จ", data };
    },

    async updateStatus(incidentId: number, input: UpdateIncidentStatusBody, session: SessionData) {
        const incident = await prisma.booklet_incident_reports.findFirst({
            where: { id: incidentId, deleted_at: null },
        });
        if (!incident) throw new AppError("ไม่พบรายงานเหตุผิดปกติ", 404);

        const isResolving = input.status === "RESOLVED" || input.status === "CLOSED";
        const data = await prisma.booklet_incident_reports.update({
            where: { id: incidentId },
            data: {
                status: input.status,
                ...(isResolving && {
                    resolved_by_account_id: session.account_id,
                    resolved_at: new Date(),
                    resolution_note: input.resolution_note ?? null,
                }),
            },
        });
        return { success: true, message: "อัปเดตสถานะสำเร็จ", data };
    },

    async delete(incidentId: number) {
        const incident = await prisma.booklet_incident_reports.findFirst({
            where: { id: incidentId, deleted_at: null },
        });
        if (!incident) throw new AppError("ไม่พบรายงานเหตุผิดปกติ", 404);
        await prisma.booklet_incident_reports.update({
            where: { id: incidentId },
            data: { deleted_at: new Date() },
        });
        return { success: true, message: "ลบรายงานสำเร็จ" };
    },
};
