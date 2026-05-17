import { AppError } from "../../cores/errors";
import { prisma } from "../../cores/prisma";
import type { CreateNoteBody, UpdateNoteBody, ReviewNoteBody } from "./booklet-notes.type";
import type { SessionData } from "../auth/auth.type";

export const bookletNoteService = {
    async findByBooklet(bookletId: number) {
        const booklet = await prisma.booklets.findFirst({ where: { id: bookletId, deleted_at: null } });
        if (!booklet) throw new AppError("ไม่พบเล่มข้อสอบ", 404);

        const data = await prisma.booklet_question_notes.findMany({
            where: { booklet_id: bookletId, deleted_at: null },
            orderBy: { created_at: "desc" },
        });
        return { success: true, message: "ดึงข้อมูลหมายเหตุสำเร็จ", data };
    },

    async create(bookletId: number, input: CreateNoteBody, session: SessionData) {
        const booklet = await prisma.booklets.findFirst({ where: { id: bookletId, deleted_at: null } });
        if (!booklet) throw new AppError("ไม่พบเล่มข้อสอบ", 404);
        if (!booklet.bag_id) throw new AppError("เล่มนี้ยังไม่อยู่ในถุง", 400);

        const data = await prisma.booklet_question_notes.create({
            data: {
                campaign_id: booklet.campaign_id,
                session_id: booklet.session_id,
                bag_id: booklet.bag_id,
                booklet_id: bookletId,
                session_subject_question_id: input.session_subject_question_id,
                slot_id: input.slot_id ?? null,
                note_type: input.note_type ?? "GENERAL",
                severity: input.severity ?? "LOW",
                note: input.note,
                status: "OPEN",
                created_by_account_id: session.account_id,
            },
        });
        return { success: true, message: "เพิ่มหมายเหตุสำเร็จ", data };
    },

    async update(noteId: number, input: UpdateNoteBody) {
        const note = await prisma.booklet_question_notes.findFirst({
            where: { id: noteId, deleted_at: null },
        });
        if (!note) throw new AppError("ไม่พบหมายเหตุ", 404);

        const data = await prisma.booklet_question_notes.update({
            where: { id: noteId },
            data: {
                ...(input.note_type !== undefined && { note_type: input.note_type }),
                ...(input.severity !== undefined && { severity: input.severity }),
                ...(input.note !== undefined && { note: input.note }),
            },
        });
        return { success: true, message: "อัปเดตหมายเหตุสำเร็จ", data };
    },

    // Manager/Admin review หมายเหตุ — บันทึกว่าใครตรวจสอบแล้ว
    async review(noteId: number, input: ReviewNoteBody, session: SessionData) {
        const note = await prisma.booklet_question_notes.findFirst({
            where: { id: noteId, deleted_at: null },
        });
        if (!note) throw new AppError("ไม่พบหมายเหตุ", 404);

        const data = await prisma.booklet_question_notes.update({
            where: { id: noteId },
            data: {
                status: input.status,
                reviewed_by_account_id: session.account_id,
                reviewed_at: new Date(),
                resolution_note: input.resolution_note ?? null,
            },
        });
        return { success: true, message: "บันทึกผลการตรวจสอบสำเร็จ", data };
    },

    async delete(noteId: number) {
        const note = await prisma.booklet_question_notes.findFirst({
            where: { id: noteId, deleted_at: null },
        });
        if (!note) throw new AppError("ไม่พบหมายเหตุ", 404);
        await prisma.booklet_question_notes.update({
            where: { id: noteId },
            data: { deleted_at: new Date() },
        });
        return { success: true, message: "ลบหมายเหตุสำเร็จ" };
    },
};
