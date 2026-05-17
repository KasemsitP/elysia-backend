import { sessionSubjectQuestionRepo } from "./session-subject-questions.repo";
import { sessionSubjectRepo } from "../session-subjects/session-subjects.repo";
import { AppError } from "../../cores/errors";
import { prisma } from "../../cores/prisma";
import type { CreateQuestionBody, UpdateQuestionBody } from "./session-subject-questions.type";

export const sessionSubjectQuestionService = {
    async findBySession(campaignId: number, sessionId: number) {
        const data = await sessionSubjectQuestionRepo.findBySession(sessionId, campaignId);
        return { success: true, message: "ดึงข้อมูลข้อสอบสำเร็จ", data };
    },

    async findBySessionSubject(sessionSubjectId: number) {
        const data = await sessionSubjectQuestionRepo.findBySessionSubject(sessionSubjectId);
        return { success: true, message: "ดึงข้อมูลข้อสอบสำเร็จ", data };
    },

    async create(sessionSubjectId: number, input: CreateQuestionBody) {
        const ss = await sessionSubjectRepo.findByIdOnly(sessionSubjectId);
        if (!ss) throw new AppError("ไม่พบวิชานี้ในวันสอบ", 404);

        const dupSession = await sessionSubjectQuestionRepo.existsByQuestionNoInSession(
            ss.session_id,
            input.question_no,
        );
        if (dupSession) throw new AppError(`ข้อที่ ${input.question_no} มีอยู่แล้วในวันสอบนี้`, 409);

        const dupSubject = await sessionSubjectQuestionRepo.existsByQuestionNoInSubject(
            sessionSubjectId,
            input.question_no,
        );
        if (dupSubject) throw new AppError(`ข้อที่ ${input.question_no} มีอยู่แล้วในวิชานี้`, 409);

        const data = await prisma.$transaction(async (tx) => {
            const question = await sessionSubjectQuestionRepo.create(
                ss.campaign_id,
                ss.session_id,
                sessionSubjectId,
                input,
                tx,
            );
            await sessionSubjectQuestionRepo.updateQuestionCount(sessionSubjectId, tx);
            return question;
        });

        return { success: true, message: "เพิ่มข้อสอบสำเร็จ", data };
    },

    async importFromTemplate(sessionSubjectId: number) {
        const ss = await prisma.session_subjects.findFirst({
            where: { id: sessionSubjectId, deleted_at: null },
            include: {
                campaign_subjects: {
                    include: { subjects: true },
                },
            },
        });
        if (!ss) throw new AppError("ไม่พบวิชานี้ในวันสอบ", 404);

        const templateQuestions = await prisma.subject_questions.findMany({
            where: { subject_id: ss.campaign_subjects.subject_id },
            orderBy: { question_no: "asc" },
        });

        if (templateQuestions.length === 0) {
            throw new AppError("ไม่มีข้อสอบต้นแบบสำหรับวิชานี้", 404);
        }

        const maxNo = await sessionSubjectQuestionRepo.getMaxQuestionNoInSession(ss.session_id);

        const records = templateQuestions.map((q, idx) => ({
            campaign_id: ss.campaign_id,
            session_id: ss.session_id,
            session_subject_id: sessionSubjectId,
            question_no: maxNo + idx + 1,
            label: q.label,
            max_score: q.max_score ?? 0,
            question_type: "REQUIRED" as const,
            note: q.note ?? null,
        }));

        await prisma.$transaction(async (tx) => {
            await sessionSubjectQuestionRepo.createMany(records, tx);
            await sessionSubjectQuestionRepo.updateQuestionCount(sessionSubjectId, tx);
        });

        const data = await sessionSubjectQuestionRepo.findBySessionSubject(sessionSubjectId);
        return { success: true, message: `นำเข้าข้อสอบจากต้นแบบสำเร็จ ${records.length} ข้อ`, data };
    },

    async update(questionId: number, input: UpdateQuestionBody) {
        const q = await sessionSubjectQuestionRepo.findById(questionId);
        if (!q) throw new AppError("ไม่พบข้อสอบ", 404);

        if (input.question_no !== undefined) {
            const dup = await sessionSubjectQuestionRepo.existsByQuestionNoInSession(
                q.session_id,
                input.question_no,
                questionId,
            );
            if (dup) throw new AppError(`ข้อที่ ${input.question_no} มีอยู่แล้วในวันสอบนี้`, 409);
        }

        const data = await sessionSubjectQuestionRepo.update(questionId, input);
        return { success: true, message: "อัปเดตข้อสอบสำเร็จ", data };
    },

    async delete(questionId: number) {
        const q = await sessionSubjectQuestionRepo.findById(questionId);
        if (!q) throw new AppError("ไม่พบข้อสอบ", 404);
        await prisma.$transaction(async (tx) => {
            await sessionSubjectQuestionRepo.softDelete(questionId, tx);
            await sessionSubjectQuestionRepo.updateQuestionCount(q.session_subject_id, tx);
        });
        return { success: true, message: "ลบข้อสอบสำเร็จ" };
    },
};
