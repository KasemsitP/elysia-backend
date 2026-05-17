import { gradingRepo } from "./grading.repo";
import { AppError } from "../../cores/errors";
import { prisma } from "../../cores/prisma";
import type {
    GradingStartBody,
    SaveDraftBody,
    UpdateDraftBody,
    ConfirmBagBody,
    CreateWorkLockBody,
} from "./grading.type";

// ดึง score_diff_threshold จาก campaign_settings (default 5)
async function getScoreDiffThreshold(campaign_id: number): Promise<number> {
    const setting = await prisma.campaign_settings.findFirst({
        where: { campaign_id, setting_key: "score_diff_threshold", active: true, deleted_at: null },
    });
    if (!setting) return 5;
    const val = Number(setting.setting_value);
    return isNaN(val) ? 5 : val;
}

export const gradingService = {
    // ── Preview Start ────────────────────────────────────────────────────────
    // ตรวจสอบว่า grader นี้สามารถเริ่มตรวจ booklet+question นี้ได้ไหม
    async previewStart(input: GradingStartBody) {
        const question = await prisma.session_subject_questions.findFirst({
            where: { id: input.session_subject_question_id, deleted_at: null },
            include: { session_subjects: { include: { campaign_subjects: true } } },
        });
        if (!question) throw new AppError("ไม่พบข้อสอบ", 404);

        const booklet = await prisma.booklets.findFirst({
            where: { id: input.booklet_id, deleted_at: null },
        });
        if (!booklet) throw new AppError("ไม่พบเล่มข้อสอบ", 404);
        if (!booklet.bag_id) throw new AppError("เล่มนี้ยังไม่อยู่ในถุง", 400);

        const assignment = await prisma.grader_assignments.findFirst({
            where: {
                grader_id: input.grader_id,
                session_subject_question_id: input.session_subject_question_id,
                active: true,
                deleted_at: null,
            },
        });
        if (!assignment) throw new AppError("ผู้ตรวจไม่มีสิทธิ์ตรวจข้อนี้", 403);

        const existingSlots = await gradingRepo.findSlotsByBookletAndQuestion(
            input.booklet_id,
            input.session_subject_question_id,
        );
        const mySlot = existingSlots.find((s) => s.grader_id === input.grader_id);
        const otherSlots = existingSlots.filter((s) => s.grader_id !== input.grader_id);

        let canStart = false;
        let reason = "";

        if (mySlot) {
            canStart = true;
            reason = "มี slot อยู่แล้ว สามารถตรวจต่อได้";
        } else if (existingSlots.length === 0) {
            canStart = true;
            reason = "จะเป็นผู้ตรวจคนที่ 1";
        } else if (existingSlots.length === 1 && otherSlots.length === 1) {
            canStart = true;
            reason = "จะเป็นผู้ตรวจคนที่ 2";
        } else {
            reason = "มีผู้ตรวจครบ 2 คนแล้ว";
        }

        return {
            success: true,
            message: reason,
            data: {
                can_start: canStart,
                current_grader_count: existingSlots.length,
                has_existing_slot: !!mySlot,
                max_score: question.max_score,
            },
        };
    },

    // ── Confirm Start ────────────────────────────────────────────────────────
    // สร้าง grading_slot + grader_work_lock
    async confirmStart(input: GradingStartBody) {
        const question = await prisma.session_subject_questions.findFirst({
            where: { id: input.session_subject_question_id, deleted_at: null },
            include: { session_subjects: { include: { campaign_subjects: true } } },
        });
        if (!question) throw new AppError("ไม่พบข้อสอบ", 404);

        const booklet = await prisma.booklets.findFirst({
            where: { id: input.booklet_id, deleted_at: null },
        });
        if (!booklet || !booklet.bag_id) throw new AppError("เล่มนี้ยังไม่อยู่ในถุง", 400);

        const assignment = await prisma.grader_assignments.findFirst({
            where: {
                grader_id: input.grader_id,
                session_subject_question_id: input.session_subject_question_id,
                active: true,
                deleted_at: null,
            },
        });
        if (!assignment) throw new AppError("ผู้ตรวจไม่มีสิทธิ์ตรวจข้อนี้", 403);

        const result = await prisma.$transaction(async (tx) => {
            const existingSlots = await gradingRepo.findSlotsByBookletAndQuestion(
                input.booklet_id,
                input.session_subject_question_id,
                tx,
            );

            // ถ้า grader มี slot อยู่แล้ว → resume
            let slot = existingSlots.find((s) => s.grader_id === input.grader_id);

            if (!slot) {
                // ตรวจสอบว่า grader ไม่ได้เป็นคนตรวจเดิมในฐานะอีก order
                if (existingSlots.length >= 2) {
                    throw new AppError("มีผู้ตรวจครบ 2 คนแล้ว ไม่สามารถเพิ่มได้", 400);
                }
                const graderOrder = existingSlots.length + 1;

                slot = await gradingRepo.createSlot(
                    {
                        campaign_id: booklet.campaign_id,
                        session_id: booklet.session_id,
                        booklet_id: input.booklet_id,
                        campaign_subject_id: question.session_subjects.campaign_subject_id,
                        session_subject_id: question.session_subject_id,
                        session_subject_question_id: input.session_subject_question_id,
                        question_no: question.question_no,
                        grader_order: graderOrder,
                        grader_id: input.grader_id,
                    },
                    tx,
                );
            }

            // ── Work Lock ────────────────────────────────────────────────────
            const activeLock = await gradingRepo.findActiveLockByGrader(input.grader_id, tx);

            if (activeLock) {
                // ถ้า lock เป็นถุงและข้อเดียวกัน → OK (resume)
                const sameWork =
                    activeLock.bag_id === booklet.bag_id &&
                    activeLock.session_subject_question_id === input.session_subject_question_id;
                if (!sameWork) {
                    throw new AppError(
                        "ผู้ตรวจมีงานค้างอยู่ กรุณาตรวจให้เสร็จก่อน",
                        400,
                    );
                }
            }

            const lock =
                activeLock ??
                (await gradingRepo.createLock(
                    {
                        grader_id: input.grader_id,
                        campaign_id: booklet.campaign_id,
                        session_id: booklet.session_id,
                        bag_id: booklet.bag_id!, // non-null: ตรวจแล้วด้านบน
                        session_subject_question_id: input.session_subject_question_id,
                        question_no: question.question_no,
                    },
                    tx,
                ));

            return { slot, lock };
        });

        return {
            success: true,
            message: "เริ่มตรวจสำเร็จ",
            data: result,
        };
    },

    // ── Save Draft ───────────────────────────────────────────────────────────
    async saveDraft(input: SaveDraftBody) {
        const slot = await prisma.grading_slots.findFirst({
            where: { id: input.slot_id, grader_id: input.grader_id, deleted_at: null },
            include: {
                booklets: { select: { bag_id: true, campaign_id: true, session_id: true } },
                session_subject_questions: { select: { max_score: true, question_no: true } },
            },
        });
        if (!slot) throw new AppError("ไม่พบ slot การตรวจ", 404);
        if (!slot.booklets.bag_id) throw new AppError("เล่มนี้ยังไม่อยู่ในถุง", 400);

        if (input.score > slot.session_subject_questions.max_score) {
            throw new AppError(
                `คะแนนต้องไม่เกิน ${slot.session_subject_questions.max_score}`,
                400,
            );
        }
        if (input.score < 0) throw new AppError("คะแนนต้องไม่ติดลบ", 400);

        const draft = await gradingRepo.upsertDraft({
            slot_id: input.slot_id,
            grader_id: input.grader_id,
            campaign_id: slot.booklets.campaign_id,
            session_id: slot.booklets.session_id,
            bag_id: slot.booklets.bag_id,
            booklet_id: slot.booklet_id,
            campaign_subject_id: slot.campaign_subject_id,
            session_subject_id: slot.session_subject_id,
            session_subject_question_id: slot.session_subject_question_id,
            question_no: slot.session_subject_questions.question_no,
            score: input.score,
        });

        return { success: true, message: "บันทึกคะแนน draft สำเร็จ", data: draft };
    },

    async updateDraft(draftId: number, input: UpdateDraftBody) {
        const draft = await prisma.grading_score_drafts.findFirst({
            where: { id: draftId, status: "DRAFT", deleted_at: null },
            include: {
                grading_slots: {
                    include: {
                        session_subject_questions: { select: { max_score: true } },
                    },
                },
            },
        });
        if (!draft) throw new AppError("ไม่พบ draft หรือ draft ถูก confirm แล้ว", 404);

        const maxScore = draft.grading_slots.session_subject_questions.max_score;
        if (input.score > maxScore) throw new AppError(`คะแนนต้องไม่เกิน ${maxScore}`, 400);
        if (input.score < 0) throw new AppError("คะแนนต้องไม่ติดลบ", 400);

        const data = await prisma.grading_score_drafts.update({
            where: { id: draftId },
            data: { score: input.score },
        });
        return { success: true, message: "อัปเดตคะแนน draft สำเร็จ", data };
    },

    async getActiveDrafts(graderId: number) {
        const data = await gradingRepo.findActiveDraftsByGrader(graderId);
        return { success: true, message: "ดึงข้อมูล draft สำเร็จ", data };
    },

    async getDraftsByGraderAndBag(bagId: number, graderId: number) {
        const data = await gradingRepo.findDraftsByGraderAndBag(graderId, bagId);
        return { success: true, message: "ดึงข้อมูล draft สำเร็จ", data };
    },

    // ── Confirm Bag ──────────────────────────────────────────────────────────
    // ยืนยันคะแนนทั้งถุง → insert grading_scores → check disputed
    async confirmBag(input: ConfirmBagBody) {
        const bag = await prisma.bags.findFirst({
            where: { id: input.bag_id, deleted_at: null },
        });
        if (!bag) throw new AppError("ไม่พบถุง", 404);

        const grader = await prisma.graders.findFirst({
            where: { id: input.grader_id, deleted_at: null },
        });
        if (!grader) throw new AppError("ไม่พบผู้ตรวจ", 404);

        const threshold = await getScoreDiffThreshold(bag.campaign_id);

        const confirmedCount = await prisma.$transaction(async (tx) => {
            // ดึง drafts ทั้งหมดของ grader นี้ สำหรับ bag+question นี้
            const drafts = await tx.grading_score_drafts.findMany({
                where: {
                    grader_id: input.grader_id,
                    bag_id: input.bag_id,
                    session_subject_question_id: input.session_subject_question_id,
                    status: "DRAFT",
                    deleted_at: null,
                },
                include: {
                    grading_slots: true,
                },
            });

            if (drafts.length === 0) {
                throw new AppError("ไม่มีคะแนน draft ที่รอ confirm", 400);
            }

            // ตรวจ score range
            for (const draft of drafts) {
                if (draft.score < 0) throw new AppError(`booklet ${draft.booklet_id}: คะแนนไม่ถูกต้อง`, 400);
            }

            // Insert/upsert grading_scores
            for (const draft of drafts) {
                await gradingRepo.upsertScore(draft.slot_id, draft.score, input.grader_id, tx);
                await gradingRepo.updateSlotStatus(draft.slot_id, "COMPLETED", tx);
            }

            // Confirm drafts
            await gradingRepo.confirmDrafts(
                input.grader_id,
                input.bag_id,
                input.session_subject_question_id,
                tx,
            );

            // Release work lock
            await gradingRepo.releaseActiveLock(
                input.grader_id,
                input.bag_id,
                input.session_subject_question_id,
                tx,
            );

            // ── Disputed Check ──────────────────────────────────────────────
            // ตรวจทีละเล่มว่า grader 1 และ 2 ต่างกันเกิน threshold ไหม
            const disputedBooklets: number[] = [];
            for (const draft of drafts) {
                const allSlots = await tx.grading_slots.findMany({
                    where: {
                        booklet_id: draft.booklet_id,
                        session_subject_question_id: input.session_subject_question_id,
                        status: "COMPLETED",
                        deleted_at: null,
                    },
                    include: { grading_scores: true },
                });

                // มีทั้ง grader 1 และ 2 confirm แล้ว
                if (allSlots.length === 2) {
                    const score0 = allSlots[0]?.grading_scores[0]?.score;
                    const score1 = allSlots[1]?.grading_scores[0]?.score;
                    if (score0 != null && score1 != null) {
                        if (Math.abs(score0 - score1) > threshold) {
                            disputedBooklets.push(draft.booklet_id);
                            await tx.grading_slots.updateMany({
                                where: {
                                    booklet_id: draft.booklet_id,
                                    session_subject_question_id: input.session_subject_question_id,
                                },
                                data: { status: "DISPUTED" },
                            });
                        }
                    }
                }
            }

            return { confirmed: drafts.length, disputed: disputedBooklets };
        });

        return {
            success: true,
            message: `ยืนยันคะแนนสำเร็จ ${confirmedCount.confirmed} เล่ม${confirmedCount.disputed.length > 0 ? ` (DISPUTED ${confirmedCount.disputed.length} เล่ม)` : ""}`,
            data: confirmedCount,
        };
    },

    // ── Work Locks ───────────────────────────────────────────────────────────
    async getActiveLock(graderId: number) {
        const data = await gradingRepo.findActiveLockByGrader(graderId);
        return { success: true, message: "ดึงข้อมูล work lock สำเร็จ", data };
    },

    async createWorkLock(input: CreateWorkLockBody) {
        const existing = await gradingRepo.findActiveLockByGrader(input.grader_id);
        if (existing) throw new AppError("ผู้ตรวจมีงานค้างอยู่แล้ว", 409);
        const data = await gradingRepo.createLock(input);
        return { success: true, message: "สร้าง work lock สำเร็จ", data };
    },

    async releaseLock(lockId: number) {
        const lock = await gradingRepo.findLockById(lockId);
        if (!lock) throw new AppError("ไม่พบ work lock", 404);
        if (lock.status !== "ACTIVE") throw new AppError("lock นี้ไม่ได้ active อยู่", 400);
        const data = await gradingRepo.updateLockStatus(lockId, "RELEASED");
        return { success: true, message: "Release lock สำเร็จ", data };
    },

    async cancelLock(lockId: number) {
        const lock = await gradingRepo.findLockById(lockId);
        if (!lock) throw new AppError("ไม่พบ work lock", 404);
        if (lock.status !== "ACTIVE") throw new AppError("lock นี้ไม่ได้ active อยู่", 400);
        const data = await gradingRepo.updateLockStatus(lockId, "CANCELLED");
        return { success: true, message: "ยกเลิก lock สำเร็จ", data };
    },
};
