import { t } from "elysia";

// ── Campaign-scoped param ────────────────────────────────────────────────────
export const campaignIdParamSchema = t.Object({
    campaignId: t.Numeric(),
});

// ── New campaign-scoped bodies ───────────────────────────────────────────────
export const verifyFirstScanBodySchema = t.Object({
    qrPayload: t.String({ minLength: 1 }),
    sessionSubjectQuestionId: t.Number(),
});

export const startWorkBodySchema = t.Object({
    bagId: t.Number(),
    sessionSubjectQuestionId: t.Number(),
});

export const saveDraftScoreBodySchema = t.Object({
    draftId: t.Number(),
    score: t.Integer({ minimum: 0 }),
});

export const confirmWorkBodySchema = t.Object({
    lockId: t.Number(),
});

export const cancelWorkBodySchema = t.Object({
    lockId: t.Number(),
    reason: t.Optional(t.String()),
});

// ── Legacy schemas (kept for existing routes) ────────────────────────────────
export const graderIdParamSchema = t.Object({
    graderId: t.Numeric(),
});

export const bagGraderParamSchema = t.Object({
    bagId: t.Numeric(),
    graderId: t.Numeric(),
});

export const draftIdParamSchema = t.Object({
    draftId: t.Numeric(),
});

export const lockIdParamSchema = t.Object({
    lockId: t.Numeric(),
});

// ตรวจสอบ/เริ่มต้นการตรวจ
export const gradingStartBodySchema = t.Object({
    grader_id: t.Number(),
    session_subject_question_id: t.Number(),
    booklet_id: t.Number(),
});

// บันทึกคะแนน draft
export const saveDraftBodySchema = t.Object({
    grader_id: t.Number(),
    slot_id: t.Number(),
    score: t.Integer({ minimum: 0 }),
});

export const updateDraftBodySchema = t.Object({
    score: t.Integer({ minimum: 0 }),
});

// ยืนยันคะแนนทั้งถุง
export const confirmBagBodySchema = t.Object({
    grader_id: t.Number(),
    bag_id: t.Number(),
    session_subject_question_id: t.Number(),
});

// สร้าง work lock
export const createWorkLockBodySchema = t.Object({
    grader_id: t.Number(),
    campaign_id: t.Number(),
    session_id: t.Number(),
    bag_id: t.Number(),
    session_subject_question_id: t.Number(),
    question_no: t.Number(),
});
