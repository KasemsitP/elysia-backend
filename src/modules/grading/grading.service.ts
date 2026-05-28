import { gradingRepo } from "./grading.repo";
import { AppError } from "../../cores/errors";
import { prisma } from "../../cores/prisma";
import { getNumberSetting } from "../../cores/settings";
import type {
    GradingStartBody,
    SaveDraftBody,
    UpdateDraftBody,
    ConfirmBagBody,
    CreateWorkLockBody,
    VerifyFirstScanBody,
    StartWorkBody,
    SaveDraftScoreBody,
    ConfirmWorkBody,
    CancelWorkBody,
} from "./grading.type";

const SCORE_NOT_SET = -1; // sentinel: draft exists but no score entered yet

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

    async updateDraft(draftId: number, graderId: number, input: UpdateDraftBody) {
        const draft = await prisma.grading_score_drafts.findFirst({
            where: { id: draftId, grader_id: graderId, status: "DRAFT", deleted_at: null },
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

        const threshold = await getNumberSetting(bag.campaign_id, "score_diff_threshold", 5);

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

    // ════════════════════════════════════════════════════════════════════════
    // Campaign-scoped grading flow (session-inferred grader)
    // ════════════════════════════════════════════════════════════════════════

    async getMyQuestions(campaignId: number, accountId: number) {
        const graderRow = await prisma.graders.findFirst({
            where: { account_id: accountId, campaign_id: campaignId, deleted_at: null },
            select: { id: true },
        });
        if (!graderRow) throw new AppError("บัญชีนี้ไม่มีสิทธิ์ตรวจข้อสอบในรอบสอบนี้", 403);
        const graderId = graderRow.id;

        const assignments = await prisma.grader_assignments.findMany({
            where: {
                grader_id: graderId,
                campaign_id: campaignId,
                active: true,
                deleted_at: null,
            },
            include: {
                session_subject_questions: { select: { id: true, question_no: true, label: true, max_score: true } },
                campaign_subjects: { select: { id: true, name: true } },
                sessions: { select: { id: true, session_code: true } },
            },
            orderBy: { id: "asc" },
        });

        const data = assignments.map((a) => {
            const q = a.session_subject_questions;
            return {
                assignmentId: a.id,
                graderId: a.grader_id,
                campaignId: a.campaign_id,
                sessionId: a.session_id,
                sessionCode: a.sessions.session_code,
                campaignSubjectId: a.campaign_subject_id,
                sessionSubjectId: a.session_subject_id,
                sessionSubjectQuestionId: q.id,
                questionNo: q.question_no,
                questionLabel: `ข้อ ${q.question_no} ${q.label}`,
                subjectName: a.campaign_subjects.name,
                maxScore: q.max_score,
            };
        });

        return { success: true, data };
    },

    async getActiveWork(campaignId: number, accountId: number) {
        const graderRow = await prisma.graders.findFirst({
            where: { account_id: accountId, campaign_id: campaignId, deleted_at: null },
            select: { id: true },
        });
        if (!graderRow) {
            return { success: true, data: { hasActiveWork: false, lock: null, drafts: [] } };
        }
        const graderId = graderRow.id;

        const activeLock = await gradingRepo.findActiveLockByGraderAndCampaign(graderId, campaignId);

        if (!activeLock) {
            return { success: true, data: { hasActiveWork: false, lock: null, drafts: [] } };
        }

        const q = activeLock.session_subject_questions;
        const lockData = {
            id: activeLock.id,
            campaignId: activeLock.campaign_id,
            sessionId: activeLock.session_id,
            bagId: activeLock.bag_id,
            bagNo: activeLock.bags.bag_no,
            sessionSubjectQuestionId: activeLock.session_subject_question_id,
            questionNo: q.question_no,
            questionLabel: `ข้อ ${q.question_no} ${q.label}`,
            subjectName: q.session_subjects.campaign_subjects?.name ?? "",
            maxScore: q.max_score,
            status: activeLock.status,
        };

        const draftRows = await gradingRepo.findDraftsForWork(
            graderId, campaignId, activeLock.bag_id, activeLock.session_subject_question_id,
        );

        const drafts = draftRows.map((d) => ({
            draftId: d.id,
            bookletId: d.booklet_id,
            seqInBag: d.booklets.seq_in_bag ?? 0,
            randomNum: d.booklets.random_num ?? "",
            qrPayload: d.booklets.qr_payload,
            score: d.score === SCORE_NOT_SET ? null : d.score,
            status: d.status,
        }));

        return { success: true, data: { hasActiveWork: true, lock: lockData, drafts } };
    },

    async verifyFirstScan(campaignId: number, accountId: number, body: VerifyFirstScanBody) {
        const graderRow = await prisma.graders.findFirst({
            where: { account_id: accountId, campaign_id: campaignId, deleted_at: null },
            select: { id: true },
        });
        if (!graderRow) throw new AppError("บัญชีนี้ไม่มีสิทธิ์ตรวจข้อสอบในรอบสอบนี้", 403);
        const graderId = graderRow.id;

        const booklet = await prisma.booklets.findUnique({
            where: { qr_payload: body.qrPayload },
        });
        if (!booklet) throw new AppError("ไม่พบเล่มข้อสอบจาก QR นี้", 404);
        if (booklet.campaign_id !== campaignId) throw new AppError("QR นี้ไม่ใช่ของรอบสอบนี้", 400);
        if (!booklet.bag_id) throw new AppError("เล่มข้อสอบนี้ยังไม่ได้จัดเข้าถุง", 400);

        const question = await prisma.session_subject_questions.findFirst({
            where: { id: body.sessionSubjectQuestionId, campaign_id: campaignId, deleted_at: null },
            include: {
                session_subjects: {
                    select: {
                        campaign_subject_id: true,
                        campaign_subjects: { select: { name: true } },
                    },
                },
            },
        });
        if (!question) throw new AppError("ไม่พบข้อสอบ", 404);

        if (question.session_id !== booklet.session_id) {
            throw new AppError("ข้อสอบที่เลือกไม่ตรงกับวันสอบของเล่มข้อสอบ", 400);
        }

        const assignment = await prisma.grader_assignments.findFirst({
            where: {
                grader_id: graderId,
                session_subject_question_id: body.sessionSubjectQuestionId,
                campaign_id: campaignId,
                active: true,
                deleted_at: null,
            },
        });
        if (!assignment) throw new AppError("คุณไม่มีสิทธิ์ตรวจข้อสอบข้อนี้", 403);

        const activeLock = await gradingRepo.findActiveLockForBagAndQuestion(
            booklet.bag_id, body.sessionSubjectQuestionId,
        );
        if (activeLock && activeLock.grader_id !== graderId) {
            const holderName = activeLock.graders?.accounts?.full_name ?? "ผู้ตรวจคนอื่น";
            throw new AppError(`ถุงนี้กำลังถูกตรวจโดย ${holderName}`, 409);
        }

        const bag = await prisma.bags.findFirst({
            where: { id: booklet.bag_id, campaign_id: campaignId, deleted_at: null },
        });
        if (!bag) throw new AppError("ไม่พบถุงข้อสอบ", 404);

        const bookletCount = await prisma.booklets.count({
            where: { bag_id: bag.id, deleted_at: null },
        });

        const booklets = await prisma.booklets.findMany({
            where: { bag_id: bag.id, deleted_at: null },
            orderBy: { seq_in_bag: "asc" },
            select: { random_num: true },
        });
        const nums = booklets.map((b) => b.random_num ?? "").filter(Boolean);
        const randomNumRange = nums.length >= 2
            ? `${nums[0]} - ${nums[nums.length - 1]}`
            : nums[0] ?? "";

        return {
            success: true,
            data: {
                canStart: true,
                preview: {
                    campaignId,
                    sessionId: bag.session_id,
                    bagId: bag.id,
                    bagNo: bag.bag_no,
                    sessionSubjectQuestionId: question.id,
                    questionNo: question.question_no,
                    questionLabel: `ข้อ ${question.question_no} ${question.label}`,
                    subjectName: question.session_subjects?.campaign_subjects?.name ?? "",
                    maxScore: question.max_score,
                    bookletCount,
                    randomNumRange,
                },
            },
        };
    },

    async startWork(campaignId: number, accountId: number, body: StartWorkBody) {
        const graderRow = await prisma.graders.findFirst({
            where: { account_id: accountId, campaign_id: campaignId, deleted_at: null },
            select: { id: true },
        });
        if (!graderRow) throw new AppError("บัญชีนี้ไม่มีสิทธิ์ตรวจข้อสอบในรอบสอบนี้", 403);
        const graderId = graderRow.id;

        const { bagId, sessionSubjectQuestionId } = body;

        const question = await prisma.session_subject_questions.findFirst({
            where: { id: sessionSubjectQuestionId, campaign_id: campaignId, deleted_at: null },
            include: {
                session_subjects: {
                    select: {
                        campaign_subject_id: true,
                        campaign_subjects: { select: { name: true } },
                    },
                },
            },
        });
        if (!question) throw new AppError("ไม่พบข้อสอบ", 404);

        const assignment = await prisma.grader_assignments.findFirst({
            where: {
                grader_id: graderId,
                session_subject_question_id: sessionSubjectQuestionId,
                campaign_id: campaignId,
                active: true,
                deleted_at: null,
            },
        });
        if (!assignment) throw new AppError("คุณไม่มีสิทธิ์ตรวจข้อสอบข้อนี้", 403);

        const bag = await prisma.bags.findFirst({
            where: { id: bagId, campaign_id: campaignId, deleted_at: null },
        });
        if (!bag) throw new AppError("ไม่พบถุงข้อสอบ", 404);

        const { lock, drafts, isResume } = await prisma.$transaction(async (tx) => {
            // Concurrency check: any active lock on this bag+question
            const existingLock = await tx.grader_work_locks.findFirst({
                where: { bag_id: bagId, session_subject_question_id: sessionSubjectQuestionId, status: "ACTIVE" },
            });

            if (existingLock) {
                if (existingLock.grader_id === graderId) {
                    // Resume own work
                    const draftRows = await gradingRepo.findDraftsForWork(
                        graderId, campaignId, bagId, sessionSubjectQuestionId, tx,
                    );
                    return { lock: existingLock, drafts: draftRows, isResume: true };
                }
                throw new AppError("ถุงนี้กำลังถูกตรวจโดยผู้ตรวจคนอื่น", 409);
            }

            // Check grader has no other active lock in this campaign
            const graderOtherLock = await tx.grader_work_locks.findFirst({
                where: { grader_id: graderId, campaign_id: campaignId, status: "ACTIVE" },
            });
            if (graderOtherLock) {
                throw new AppError("คุณมีงานตรวจค้างอยู่ กรุณายืนยันหรือยกเลิกก่อน", 400);
            }

            // Create lock
            const newLock = await tx.grader_work_locks.create({
                data: {
                    grader_id: graderId,
                    campaign_id: campaignId,
                    session_id: bag.session_id,
                    bag_id: bagId,
                    session_subject_question_id: sessionSubjectQuestionId,
                    question_no: question.question_no,
                    status: "ACTIVE",
                },
            });

            // Load booklets and create slots + drafts
            const booklets = await gradingRepo.findBookletsInBagWithQr(bagId, tx);
            const draftRows = [];

            for (const booklet of booklets) {
                // Find or create slot
                let slot = await tx.grading_slots.findFirst({
                    where: {
                        grader_id: graderId,
                        booklet_id: booklet.id,
                        session_subject_question_id: sessionSubjectQuestionId,
                        deleted_at: null,
                    },
                });

                if (!slot) {
                    const existingSlots = await tx.grading_slots.findMany({
                        where: {
                            booklet_id: booklet.id,
                            session_subject_question_id: sessionSubjectQuestionId,
                            deleted_at: null,
                        },
                    });
                    slot = await tx.grading_slots.create({
                        data: {
                            campaign_id: campaignId,
                            session_id: bag.session_id,
                            booklet_id: booklet.id,
                            campaign_subject_id: question.session_subjects.campaign_subject_id,
                            session_subject_id: question.session_subject_id,
                            session_subject_question_id: sessionSubjectQuestionId,
                            question_no: question.question_no,
                            grader_order: existingSlots.length + 1,
                            grader_id: graderId,
                        },
                    });
                }

                // Find or create draft
                const draft = await gradingRepo.upsertDraftForSlot({
                    slot_id: slot.id,
                    grader_id: graderId,
                    campaign_id: campaignId,
                    session_id: bag.session_id,
                    bag_id: bagId,
                    booklet_id: booklet.id,
                    campaign_subject_id: question.session_subjects.campaign_subject_id,
                    session_subject_id: question.session_subject_id,
                    session_subject_question_id: sessionSubjectQuestionId,
                    question_no: question.question_no,
                }, tx);

                draftRows.push({
                    draftId: draft.id,
                    bookletId: booklet.id,
                    seqInBag: booklet.seq_in_bag ?? 0,
                    randomNum: booklet.random_num ?? "",
                    qrPayload: booklet.qr_payload,
                    score: draft.score === SCORE_NOT_SET ? null : draft.score,
                    status: draft.status,
                });
            }

            return { lock: newLock, drafts: draftRows, isResume: false };
        });

        const lockData = {
            id: lock.id,
            campaignId: lock.campaign_id,
            sessionId: lock.session_id,
            bagId: lock.bag_id,
            bagNo: bag.bag_no,
            sessionSubjectQuestionId: lock.session_subject_question_id,
            questionNo: question.question_no,
            questionLabel: `ข้อ ${question.question_no} ${question.label}`,
            subjectName: question.session_subjects?.campaign_subjects?.name ?? "",
            maxScore: question.max_score,
            status: lock.status,
        };

        // Map drafts if resuming (draftRows from resume path are full Prisma records)
        const mappedDrafts = isResume
            ? (drafts as any[]).map((d) => ({
                draftId: d.id,
                bookletId: d.booklet_id,
                seqInBag: d.booklets?.seq_in_bag ?? 0,
                randomNum: d.booklets?.random_num ?? "",
                qrPayload: d.booklets?.qr_payload ?? "",
                score: d.score === SCORE_NOT_SET ? null : d.score,
                status: d.status,
            }))
            : drafts;

        return {
            success: true,
            message: isResume ? "กำลังตรวจถุงนี้อยู่แล้ว" : "เริ่มตรวจถุงข้อสอบสำเร็จ",
            data: { lock: lockData, drafts: mappedDrafts },
        };
    },

    async saveDraftScore(campaignId: number, accountId: number, body: SaveDraftScoreBody) {
        const graderRow = await prisma.graders.findFirst({
            where: { account_id: accountId, campaign_id: campaignId, deleted_at: null },
            select: { id: true },
        });
        if (!graderRow) throw new AppError("บัญชีนี้ไม่มีสิทธิ์ตรวจข้อสอบในรอบสอบนี้", 403);
        const graderId = graderRow.id;

        const draft = await gradingRepo.findDraftWithSlotAndQuestion(body.draftId, graderId);
        if (!draft) throw new AppError("ไม่พบ draft หรือไม่มีสิทธิ์แก้ไข", 404);

        const maxScore = draft.grading_slots.session_subject_questions.max_score;
        if (body.score < 0 || body.score > maxScore) {
            throw new AppError(`คะแนนต้องอยู่ระหว่าง 0 ถึง ${maxScore}`, 400);
        }

        await gradingRepo.updateDraftScoreById(body.draftId, graderId, body.score);

        return {
            success: true,
            message: "บันทึกคะแนนฉบับร่างสำเร็จ",
            data: { draftId: body.draftId, score: body.score, status: "DRAFT" },
        };
    },

    async confirmWork(campaignId: number, accountId: number, body: ConfirmWorkBody) {
        const graderRow = await prisma.graders.findFirst({
            where: { account_id: accountId, campaign_id: campaignId, deleted_at: null },
            select: { id: true },
        });
        if (!graderRow) throw new AppError("บัญชีนี้ไม่มีสิทธิ์ตรวจข้อสอบในรอบสอบนี้", 403);
        const graderId = graderRow.id;

        const lock = await gradingRepo.findLockById(body.lockId);
        if (!lock) throw new AppError("ไม่พบ work lock", 404);
        if (lock.grader_id !== graderId) throw new AppError("ไม่มีสิทธิ์ยืนยันงานนี้", 403);
        if (lock.status !== "ACTIVE") throw new AppError("lock นี้ไม่ได้ active อยู่", 400);

        const threshold = await getNumberSetting(lock.campaign_id, "score_diff_threshold", 5);

        const confirmedCount = await prisma.$transaction(async (tx) => {
            // Fetch inside transaction to avoid TOCTOU between validation and write
            const drafts = await tx.grading_score_drafts.findMany({
                where: {
                    grader_id: graderId,
                    campaign_id: lock.campaign_id,
                    bag_id: lock.bag_id,
                    session_subject_question_id: lock.session_subject_question_id,
                    status: "DRAFT",
                    deleted_at: null,
                },
                include: { grading_slots: true },
            });

            if (drafts.length === 0) throw new AppError("ไม่มีคะแนน draft ที่รอยืนยัน", 400);

            const unscored = drafts.filter((d) => d.score === SCORE_NOT_SET || d.score < 0);
            if (unscored.length > 0) {
                throw new AppError("กรุณากรอกคะแนนให้ครบทุกเล่มก่อนยืนยัน", 400);
            }

            for (const draft of drafts) {
                await gradingRepo.upsertScore(draft.slot_id, draft.score, graderId, tx);
                await gradingRepo.updateSlotStatus(draft.slot_id, "COMPLETED", tx);
            }

            await tx.grading_score_drafts.updateMany({
                where: {
                    grader_id: graderId,
                    campaign_id: lock.campaign_id,
                    bag_id: lock.bag_id,
                    session_subject_question_id: lock.session_subject_question_id,
                    status: "DRAFT",
                },
                data: { status: "CONFIRMED" },
            });

            await gradingRepo.completeLock(body.lockId, tx);

            // Disputed check
            for (const draft of drafts) {
                const allSlots = await tx.grading_slots.findMany({
                    where: {
                        booklet_id: draft.booklet_id,
                        session_subject_question_id: lock.session_subject_question_id,
                        status: "COMPLETED",
                        deleted_at: null,
                    },
                    include: { grading_scores: true },
                });
                if (allSlots.length === 2) {
                    // Match score to slot owner to avoid comparing a grader's score against themselves
                    const s0 = allSlots[0]?.grading_scores.find(
                        (s) => s.entered_by === allSlots[0]!.grader_id,
                    )?.score;
                    const s1 = allSlots[1]?.grading_scores.find(
                        (s) => s.entered_by === allSlots[1]!.grader_id,
                    )?.score;
                    if (s0 != null && s1 != null && Math.abs(s0 - s1) > threshold) {
                        await tx.grading_slots.updateMany({
                            where: {
                                booklet_id: draft.booklet_id,
                                session_subject_question_id: lock.session_subject_question_id,
                                status: "COMPLETED",
                            },
                            data: { status: "DISPUTED" },
                        });
                    }
                }
            }

            return drafts.length;
        });

        return {
            success: true,
            message: "ยืนยันคะแนนสำเร็จ",
            data: { confirmedCount, bagId: lock.bag_id, lockId: body.lockId },
        };
    },

    async cancelWork(campaignId: number, accountId: number, body: CancelWorkBody) {
        const graderRow = await prisma.graders.findFirst({
            where: { account_id: accountId, campaign_id: campaignId, deleted_at: null },
            select: { id: true },
        });
        if (!graderRow) throw new AppError("บัญชีนี้ไม่มีสิทธิ์ตรวจข้อสอบในรอบสอบนี้", 403);
        const graderId = graderRow.id;

        const lock = await gradingRepo.findLockById(body.lockId);
        if (!lock) throw new AppError("ไม่พบ work lock", 404);
        if (lock.grader_id !== graderId) throw new AppError("ไม่มีสิทธิ์ยกเลิกงานนี้", 403);
        if (lock.status !== "ACTIVE") throw new AppError("lock นี้ไม่ได้ active อยู่", 400);

        await prisma.$transaction(async (tx) => {
            await gradingRepo.cancelDraftsForWork(
                graderId, lock.campaign_id, lock.bag_id, lock.session_subject_question_id, tx,
            );
            await gradingRepo.cancelLockById(body.lockId, tx);
        });

        return { success: true, message: "ยกเลิกการตรวจถุงข้อสอบสำเร็จ" };
    },
};
