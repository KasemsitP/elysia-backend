import { scoreResetRepo } from "./score-reset.repo";
import { AppError } from "../../cores/errors";
import { prisma } from "../../cores/prisma";
import type { ScoreResetCasesQuery, ScoreResetConfirmBody } from "./score-reset.type";

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseCaseId(caseId: string): { bookletId: number; questionId: number } {
    const parts = caseId.split("_");
    if (parts.length !== 2) throw new AppError("รูปแบบ caseId ไม่ถูกต้อง", 400);
    const bookletId = Number(parts[0]);
    const questionId = Number(parts[1]);
    if (isNaN(bookletId) || isNaN(questionId)) throw new AppError("รูปแบบ caseId ไม่ถูกต้อง", 400);
    return { bookletId, questionId };
}

// ── Service ───────────────────────────────────────────────────────────────────

export const scoreResetService = {
    // ── GET /campaigns/:campaignId/cases ─────────────────────────────────────
    async getCases(campaignId: number, query: ScoreResetCasesQuery) {
        const {
            page = 1,
            limit = 20,
            bagId,
            sessionSubjectQuestionId,
            subjectId,
            status = "ALL",
            sortBy = "bagNo",
            sortOrder = "asc",
            search,
        } = query;

        // Determine which slot statuses to load
        const targetStatuses =
            status === "PENDING" ? ["DISPUTED"] :
            status === "RESET_DONE" ? ["RESET"] :
            ["DISPUTED", "RESET"];

        const allSlots = await scoreResetRepo.findDisputedOrResetSlots(campaignId, targetStatuses);

        // Group slots into pairs by caseId
        const caseMap = new Map<string, typeof allSlots>();
        for (const slot of allSlots) {
            const key = `${slot.booklet_id}_${slot.session_subject_question_id}`;
            if (!caseMap.has(key)) caseMap.set(key, []);
            caseMap.get(key)!.push(slot);
        }

        // Load related data
        const bookletIds = [...new Set(allSlots.map((s) => s.booklet_id))];
        const questionIds = [...new Set(allSlots.map((s) => s.session_subject_question_id))];

        const [booklets, questions] = await Promise.all([
            scoreResetRepo.findBookletsForIds(bookletIds),
            scoreResetRepo.findQuestionsForIds(questionIds),
        ]);

        const bagIds = [...new Set(booklets.map((b) => b.bag_id).filter((id): id is number => id !== null))];
        const bags = await scoreResetRepo.findBagsForIds(bagIds);

        const bookletMap = new Map(booklets.map((b) => [b.id, b]));
        const bagMap = new Map(bags.map((b) => [b.id, b]));
        const questionMap = new Map(questions.map((q) => [q.id, q]));

        // Build case objects
        type CaseItem = {
            caseId: string;
            bookletId: number;
            questionId: number;
            bagId: number | null;
            bagNo: number | null;
            randomNum: string | null;
            questionNo: number;
            questionLabel: string;
            subjectId: number | null;
            subjectName: string;
            g1Score: number | null;
            g2Score: number | null;
            difference: number;
            averageScore: number;
            pairStatus: "PENDING" | "RESET_DONE";
        };

        const cases: CaseItem[] = [];

        for (const [caseId, slots] of caseMap.entries()) {
            const { bookletId, questionId } = parseCaseId(caseId);
            const booklet = bookletMap.get(bookletId);
            const question = questionMap.get(questionId);

            const bag = booklet?.bag_id != null ? bagMap.get(booklet.bag_id) ?? null : null;

            const slot1 = slots.find((s) => s.grader_order === 1);
            const slot2 = slots.find((s) => s.grader_order === 2);

            const g1Score = slot1?.grading_scores[0]?.score ?? null;
            const g2Score = slot2?.grading_scores[0]?.score ?? null;

            const difference = g1Score != null && g2Score != null ? Math.abs(g1Score - g2Score) : 0;
            const averageScore = g1Score != null && g2Score != null ? (g1Score + g2Score) / 2 : 0;

            const bothReset = slots.length > 0 && slots.every((s) => s.status === "RESET");
            const pairStatus: "PENDING" | "RESET_DONE" = bothReset ? "RESET_DONE" : "PENDING";

            const subjectInfo = question?.session_subjects?.campaign_subjects;

            cases.push({
                caseId,
                bookletId,
                questionId,
                bagId: bag?.id ?? null,
                bagNo: bag?.bag_no ?? null,
                randomNum: booklet?.random_num ?? null,
                questionNo: question?.question_no ?? 0,
                questionLabel: question ? `ข้อ ${question.question_no} ${question.label}` : "",
                subjectId: subjectInfo?.id ?? null,
                subjectName: subjectInfo?.name ?? "",
                g1Score,
                g2Score,
                difference,
                averageScore,
                pairStatus,
            });
        }

        // Filter by bagId
        let filtered = cases;
        if (bagId != null) {
            filtered = filtered.filter((c) => c.bagId === bagId);
        }

        // Filter by sessionSubjectQuestionId
        if (sessionSubjectQuestionId != null) {
            filtered = filtered.filter((c) => c.questionId === sessionSubjectQuestionId);
        }

        // Filter by subjectId
        if (subjectId != null) {
            filtered = filtered.filter((c) => c.subjectId === subjectId);
        }

        // Text search (randomNum or questionLabel)
        if (search) {
            const lower = search.toLowerCase();
            filtered = filtered.filter(
                (c) =>
                    (c.randomNum ?? "").toLowerCase().includes(lower) ||
                    c.questionLabel.toLowerCase().includes(lower),
            );
        }

        // Sort
        filtered.sort((a, b) => {
            let diff = 0;
            if (sortBy === "bagNo") diff = (a.bagNo ?? 0) - (b.bagNo ?? 0);
            else if (sortBy === "questionNo") diff = a.questionNo - b.questionNo;
            else if (sortBy === "difference") diff = a.difference - b.difference;
            else if (sortBy === "randomNum") diff = (a.randomNum ?? "").localeCompare(b.randomNum ?? "");
            return sortOrder === "desc" ? -diff : diff;
        });

        // Paginate
        const total = filtered.length;
        const skip = (page - 1) * limit;
        const paged = filtered.slice(skip, skip + limit);

        return {
            success: true,
            data: {
                items: paged,
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    },

    // ── GET /campaigns/:campaignId/bags ───────────────────────────────────────
    async getBags(campaignId: number) {
        const allSlots = await scoreResetRepo.findDisputedOrResetSlots(campaignId, ["DISPUTED", "RESET"]);
        const bookletIds = [...new Set(allSlots.map((s) => s.booklet_id))];
        const booklets = await scoreResetRepo.findBookletsForIds(bookletIds);
        const bagIds = [...new Set(booklets.map((b) => b.bag_id).filter((id): id is number => id !== null))];
        const bags = await scoreResetRepo.findBagsForIds(bagIds);

        const bookletMap = new Map(booklets.map((b) => [b.id, b]));

        // Count cases per bag
        const bagCaseCount = new Map<number, number>();
        for (const slot of allSlots) {
            const booklet = bookletMap.get(slot.booklet_id);
            if (booklet?.bag_id != null) {
                bagCaseCount.set(booklet.bag_id, (bagCaseCount.get(booklet.bag_id) ?? 0) + 1);
            }
        }
        // Divide by 2 since each case has 2 slots
        const data = bags.map((bag) => ({
            id: bag.id,
            bagNo: bag.bag_no,
            sessionCode: bag.sessions?.session_code ?? "",
            sessionTitle: bag.sessions?.title ?? "",
            caseCount: Math.ceil((bagCaseCount.get(bag.id) ?? 0) / 2),
        }));

        return { success: true, data };
    },

    // ── GET /campaigns/:campaignId/questions ──────────────────────────────────
    async getQuestions(campaignId: number) {
        const allSlots = await scoreResetRepo.findDisputedOrResetSlots(campaignId, ["DISPUTED", "RESET"]);
        const questionIds = [...new Set(allSlots.map((s) => s.session_subject_question_id))];
        const questions = await scoreResetRepo.findQuestionsForIds(questionIds);

        // Count cases per question
        const qCaseCount = new Map<number, number>();
        for (const slot of allSlots) {
            qCaseCount.set(slot.session_subject_question_id, (qCaseCount.get(slot.session_subject_question_id) ?? 0) + 1);
        }

        const data = questions.map((q) => ({
            id: q.id,
            questionNo: q.question_no,
            label: q.label,
            questionLabel: `ข้อ ${q.question_no} ${q.label}`,
            maxScore: q.max_score,
            subjectId: q.session_subjects?.campaign_subject_id ?? null,
            subjectName: q.session_subjects?.campaign_subjects?.name ?? "",
            caseCount: Math.ceil((qCaseCount.get(q.id) ?? 0) / 2),
        }));

        return { success: true, data };
    },

    // ── POST /campaigns/:campaignId/verify-scan ───────────────────────────────
    // If caseId is provided → verify the scanned booklet belongs to that specific case.
    // If caseId is omitted  → auto-find ALL pending DISPUTED cases for the scanned booklet.
    async verifyScan(campaignId: number, qrPayload: string, caseId?: string) {
        const booklet = await scoreResetRepo.findBookletByQrPayload(qrPayload);
        if (!booklet) throw new AppError("ไม่พบเล่มข้อสอบจาก QR นี้", 404);
        if (booklet.campaign_id !== campaignId) throw new AppError("QR นี้ไม่ใช่ของรอบสอบนี้", 400);

        if (caseId) {
            // Specific case verification
            const { bookletId, questionId } = parseCaseId(caseId);
            if (booklet.id !== bookletId) throw new AppError("QR ไม่ตรงกับรายการที่เลือก", 400);
            return scoreResetService._buildVerifyResult(booklet, caseId, bookletId, questionId);
        }

        // Auto-find: all DISPUTED slots for this booklet in this campaign
        const allSlots = await scoreResetRepo.findAllDisputedSlotsForBooklet(booklet.id, campaignId);
        if (allSlots.length === 0) {
            throw new AppError("ไม่พบรายการที่ต้องรีเซ็ตสำหรับเล่มนี้", 404);
        }

        // Group by questionId
        const questionIds = [...new Set(allSlots.map((s) => s.session_subject_question_id))];
        const cases = await Promise.all(
            questionIds.map((qId) =>
                scoreResetService._buildVerifyResult(
                    booklet,
                    `${booklet.id}_${qId}`,
                    booklet.id,
                    qId,
                ),
            ),
        );

        return {
            success: true,
            message: `พบ ${cases.length} รายการที่ต้องรีเซ็ตในเล่มนี้`,
            data: cases.map((c) => c.data),
        };
    },

    // Internal helper shared by both verify paths
    async _buildVerifyResult(
        booklet: { id: number; random_num: string | null },
        caseId: string,
        bookletId: number,
        questionId: number,
    ) {
        const slots = await scoreResetRepo.findSlotsForCase(bookletId, questionId);
        if (slots.length === 0) throw new AppError("ไม่พบรายการรีเซ็ตคะแนน", 404);

        const question = slots[0]!.session_subject_questions;
        return {
            success: true,
            message: "สแกน QR ถูกต้อง",
            data: {
                caseId,
                bookletId,
                questionId,
                randomNum: booklet.random_num ?? "",
                questionNo: question.question_no,
                questionLabel: `ข้อ ${question.question_no} ${question.label}`,
                subjectName: question.session_subjects?.campaign_subjects?.name ?? "",
                maxScore: question.max_score,
                slots: slots.map((s) => ({
                    slotId: s.id,
                    graderOrder: s.grader_order,
                    status: s.status,
                    currentScore: s.grading_scores[0]?.score ?? null,
                })),
            },
        };
    },

    // ── POST /campaigns/:campaignId/cases/:caseId/confirm ─────────────────────
    async confirmReset(campaignId: number, caseId: string, body: ScoreResetConfirmBody, accountId: number) {
        const { bookletId, questionId } = parseCaseId(caseId);

        const slots = await scoreResetRepo.findSlotsForCase(bookletId, questionId);
        if (slots.length === 0) throw new AppError("ไม่พบรายการรีเซ็ตคะแนน", 404);

        const slot1 = slots.find((s) => s.grader_order === 1);
        const slot2 = slots.find((s) => s.grader_order === 2);

        if (!slot1 || !slot2) throw new AppError("ไม่พบข้อมูล slot ครบทั้ง 2 คน", 400);

        const allReset = slots.every((s) => s.status === "RESET");
        if (allReset) throw new AppError("รายการนี้ถูกรีเซ็ตคะแนนแล้ว", 400);

        const question = slot1.session_subject_questions;
        const maxScore = question.max_score;

        if (body.grader1Score > maxScore) {
            throw new AppError(`คะแนนผู้ตรวจ 1 ต้องไม่เกิน ${maxScore}`, 400);
        }
        if (body.grader2Score > maxScore) {
            throw new AppError(`คะแนนผู้ตรวจ 2 ต้องไม่เกิน ${maxScore}`, 400);
        }

        const score1Record = slot1.grading_scores[0];
        const score2Record = slot2.grading_scores[0];

        const oldScore1 = score1Record?.score ?? null;
        const oldScore2 = score2Record?.score ?? null;

        await prisma.$transaction(async (tx) => {
            // Update grading_scores for slot 1
            if (score1Record) {
                await tx.grading_scores.update({
                    where: { id: score1Record.id },
                    data: { score: body.grader1Score },
                });
            } else {
                await tx.grading_scores.create({
                    data: {
                        slot_id: slot1.id,
                        score: body.grader1Score,
                        entered_by: slot1.grader_id ?? accountId,
                        entered_at: new Date(),
                    },
                });
            }

            // Update grading_scores for slot 2
            if (score2Record) {
                await tx.grading_scores.update({
                    where: { id: score2Record.id },
                    data: { score: body.grader2Score },
                });
            } else {
                await tx.grading_scores.create({
                    data: {
                        slot_id: slot2.id,
                        score: body.grader2Score,
                        entered_by: slot2.grader_id ?? accountId,
                        entered_at: new Date(),
                    },
                });
            }

            // Update both slots status to "RESET"
            await tx.grading_slots.updateMany({
                where: {
                    booklet_id: bookletId,
                    session_subject_question_id: questionId,
                    deleted_at: null,
                },
                data: { status: "RESET" },
            });

            // Create audit log
            await tx.grading_score_logs.create({
                data: {
                    campaign_id: slot1.campaign_id,
                    session_id: slot1.session_id,
                    booklet_id: bookletId,
                    campaign_subject_id: slot1.campaign_subject_id,
                    session_subject_id: slot1.session_subject_id,
                    session_subject_question_id: questionId,
                    question_no: question.question_no,
                    slot_id1: slot1.id,
                    slot_id2: slot2.id,
                    grader1_id: slot1.grader_id,
                    grader2_id: slot2.grader_id,
                    old_score1: oldScore1,
                    old_score2: oldScore2,
                    new_score1: body.grader1Score,
                    new_score2: body.grader2Score,
                    reason: "RESET",
                    changed_by: accountId,
                    changed_at: new Date(),
                },
            });
        });

        return {
            success: true,
            message: "รีเซ็ตคะแนนสำเร็จ",
            data: {
                caseId,
                bookletId,
                questionId,
                grader1Score: body.grader1Score,
                grader2Score: body.grader2Score,
                averageScore: (body.grader1Score + body.grader2Score) / 2,
            },
        };
    },
};
