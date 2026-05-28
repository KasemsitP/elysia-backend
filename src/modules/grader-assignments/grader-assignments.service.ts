import { graderAssignmentRepo } from "./grader-assignments.repo";
import { graderRepo } from "../grader/grader.repo";
import { campaignRepo } from "../campaign/campaign.repo";
import { AppError } from "../../cores/errors";
import { prisma } from "../../cores/prisma";
import type { CreateAssignmentBody, UpdateAssignmentBody } from "./grader-assignments.type";

export const graderAssignmentService = {
    async findByCampaign(campaignId: number) {
        const campaign = await campaignRepo.findById(campaignId);
        if (!campaign) throw new AppError("ไม่พบรอบสอบ", 404);
        const data = await graderAssignmentRepo.findByCampaign(campaignId);
        return { success: true, message: "ดึงข้อมูลการมอบหมายสำเร็จ", data };
    },

    async findByGrader(graderId: number) {
        const grader = await graderRepo.findById(graderId);
        if (!grader) throw new AppError("ไม่พบผู้ตรวจ", 404);
        const data = await graderAssignmentRepo.findByGrader(graderId);
        return { success: true, message: "ดึงข้อมูลการมอบหมายสำเร็จ", data };
    },

    async create(campaignId: number, input: CreateAssignmentBody) {
        // ตรวจสอบ grader อยู่ใน campaign นี้จริง
        const grader = await prisma.graders.findFirst({
            where: { id: input.grader_id, campaign_id: campaignId, deleted_at: null },
        });
        if (!grader) throw new AppError("ไม่พบผู้ตรวจในรอบสอบนี้", 404);

        // ตรวจสอบ session, campaign_subject, session_subject, question ล้วนอยู่ใน campaign
        const question = await prisma.session_subject_questions.findFirst({
            where: {
                id: input.session_subject_question_id,
                session_id: input.session_id,
                campaign_id: campaignId,
                deleted_at: null,
            },
        });
        if (!question) throw new AppError("ไม่พบข้อสอบนี้ในรอบสอบ", 404);

        // unique: grader + question
        const dup = await graderAssignmentRepo.existsByGraderAndQuestion(
            input.grader_id,
            input.session_subject_question_id,
        );
        if (dup) throw new AppError("ผู้ตรวจนี้ได้รับมอบหมายข้อนี้แล้ว", 409);

        // ถ้าข้อนี้มี grading_slots แล้ว แสดงว่าการตรวจเริ่มไปแล้ว — ห้ามเพิ่มผู้ตรวจใหม่
        const gradingStarted = await prisma.grading_slots.count({
            where: { session_subject_question_id: input.session_subject_question_id, deleted_at: null },
        });
        if (gradingStarted > 0) throw new AppError("ข้อนี้เริ่มตรวจไปแล้ว ไม่สามารถเพิ่มผู้ตรวจใหม่ได้", 400);

        const data = await graderAssignmentRepo.create(campaignId, input);
        return { success: true, message: "มอบหมายงานตรวจสำเร็จ", data };
    },

    async update(assignmentId: number, input: UpdateAssignmentBody) {
        const assignment = await graderAssignmentRepo.findById(assignmentId);
        if (!assignment) throw new AppError("ไม่พบการมอบหมายงาน", 404);
        await graderAssignmentRepo.update(assignmentId, input.active);
        return { success: true, message: "อัปเดตสถานะการมอบหมายสำเร็จ" };
    },

    async delete(assignmentId: number) {
        const assignment = await graderAssignmentRepo.findById(assignmentId);
        if (!assignment) throw new AppError("ไม่พบการมอบหมายงาน", 404);

        // ห้ามลบถ้าผู้ตรวจนี้มี grading_slots สำหรับข้อนี้แล้ว (ตรวจไปบ้างแล้ว)
        const hasGraded = await prisma.grading_slots.count({
            where: {
                grader_id: assignment.grader_id,
                session_subject_question_id: assignment.session_subject_question_id,
                deleted_at: null,
            },
        });
        if (hasGraded > 0) throw new AppError("ผู้ตรวจนี้เริ่มตรวจข้อนี้ไปแล้ว ไม่สามารถยกเลิกการมอบหมายได้", 400);

        await graderAssignmentRepo.softDelete(assignmentId);
        return { success: true, message: "ยกเลิกการมอบหมายสำเร็จ" };
    },
};
