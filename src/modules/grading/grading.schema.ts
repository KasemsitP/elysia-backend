import { t } from "elysia";

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
