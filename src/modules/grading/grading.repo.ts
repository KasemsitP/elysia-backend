import { prisma, type Tx } from "../../cores/prisma";

export const gradingRepo = {
    // ── Slots ──────────────────────────────────────────────────────────────
    async findSlotsByBookletAndQuestion(booklet_id: number, session_subject_question_id: number, tx?: Tx) {
        const client = tx ?? prisma;
        return client.grading_slots.findMany({
            where: { booklet_id, session_subject_question_id, deleted_at: null },
            orderBy: { grader_order: "asc" },
        });
    },

    async findSlotByGraderAndBookletAndQuestion(
        grader_id: number,
        booklet_id: number,
        session_subject_question_id: number,
        tx?: Tx,
    ) {
        const client = tx ?? prisma;
        return client.grading_slots.findFirst({
            where: { grader_id, booklet_id, session_subject_question_id, deleted_at: null },
        });
    },

    async createSlot(
        data: {
            campaign_id: number;
            session_id: number;
            booklet_id: number;
            campaign_subject_id: number;
            session_subject_id: number;
            session_subject_question_id: number;
            question_no: number;
            grader_order: number;
            grader_id: number;
        },
        tx?: Tx,
    ) {
        const client = tx ?? prisma;
        return client.grading_slots.create({ data });
    },

    async updateSlotStatus(id: number, status: string, tx?: Tx) {
        const client = tx ?? prisma;
        return client.grading_slots.update({ where: { id }, data: { status } });
    },

    // ── Drafts ──────────────────────────────────────────────────────────────
    async findActiveDraftsByGrader(grader_id: number, tx?: Tx) {
        const client = tx ?? prisma;
        return client.grading_score_drafts.findMany({
            where: { grader_id, status: "DRAFT", deleted_at: null },
            include: {
                booklets: { select: { id: true, random_num: true, seq_in_bag: true } },
                grading_slots: { select: { id: true, grader_order: true } },
            },
            orderBy: { id: "asc" },
        });
    },

    async findDraftsByGraderAndBag(grader_id: number, bag_id: number, tx?: Tx) {
        const client = tx ?? prisma;
        return client.grading_score_drafts.findMany({
            where: { grader_id, bag_id, deleted_at: null },
            include: {
                booklets: { select: { id: true, random_num: true, seq_in_bag: true } },
            },
            orderBy: { id: "asc" },
        });
    },

    async findDraftBySlot(slot_id: number, tx?: Tx) {
        const client = tx ?? prisma;
        return client.grading_score_drafts.findFirst({
            where: { slot_id, deleted_at: null },
        });
    },

    async upsertDraft(
        data: {
            slot_id: number;
            grader_id: number;
            campaign_id: number;
            session_id: number;
            bag_id: number;
            booklet_id: number;
            campaign_subject_id: number;
            session_subject_id: number;
            session_subject_question_id: number;
            question_no: number;
            score: number;
        },
        tx?: Tx,
    ) {
        const client = tx ?? prisma;
        return client.grading_score_drafts.upsert({
            where: { slot_id: data.slot_id },
            create: { ...data, status: "DRAFT" },
            update: { score: data.score },
        });
    },

    async confirmDrafts(grader_id: number, bag_id: number, session_subject_question_id: number, tx?: Tx) {
        const client = tx ?? prisma;
        return client.grading_score_drafts.updateMany({
            where: { grader_id, bag_id, session_subject_question_id, status: "DRAFT" },
            data: { status: "CONFIRMED" },
        });
    },

    // ── Scores (confirmed) ──────────────────────────────────────────────────
    async upsertScore(slot_id: number, score: number, entered_by: number, tx?: Tx) {
        const client = tx ?? prisma;
        return client.grading_scores.upsert({
            where: { slot_id_entered_by: { slot_id, entered_by } },
            create: { slot_id, score, entered_by },
            update: { score },
        });
    },

    async findScoreBySlot(slot_id: number, tx?: Tx) {
        const client = tx ?? prisma;
        return client.grading_scores.findFirst({ where: { slot_id } });
    },

    // ── Work Locks ──────────────────────────────────────────────────────────
    async findActiveLockByGrader(grader_id: number, tx?: Tx) {
        const client = tx ?? prisma;
        return client.grader_work_locks.findFirst({
            where: { grader_id, status: "ACTIVE" },
        });
    },

    async findLockById(id: number, tx?: Tx) {
        const client = tx ?? prisma;
        return client.grader_work_locks.findFirst({ where: { id } });
    },

    async createLock(
        data: {
            grader_id: number;
            campaign_id: number;
            session_id: number;
            bag_id: number;
            session_subject_question_id: number;
            question_no: number;
            created_by?: number;
        },
        tx?: Tx,
    ) {
        const client = tx ?? prisma;
        return client.grader_work_locks.create({ data: { ...data, status: "ACTIVE" } });
    },

    async updateLockStatus(id: number, status: "RELEASED" | "CANCELLED", tx?: Tx) {
        const client = tx ?? prisma;
        return client.grader_work_locks.update({
            where: { id },
            data: { status, released_at: new Date() },
        });
    },

    async releaseActiveLock(grader_id: number, bag_id: number, question_id: number, tx?: Tx) {
        const client = tx ?? prisma;
        return client.grader_work_locks.updateMany({
            where: { grader_id, bag_id, session_subject_question_id: question_id, status: "ACTIVE" },
            data: { status: "RELEASED", released_at: new Date() },
        });
    },
};
