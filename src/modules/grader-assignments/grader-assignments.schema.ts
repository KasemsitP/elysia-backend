import { t } from "elysia";

export const assignmentCampaignParamSchema = t.Object({
    campaignId: t.Numeric(),
});

export const assignmentGraderParamSchema = t.Object({
    graderId: t.Numeric(),
});

export const assignmentIdParamSchema = t.Object({
    assignmentId: t.Numeric(),
});

// กำหนดว่า grader นี้ตรวจข้อไหน
export const createAssignmentBodySchema = t.Object({
    grader_id: t.Number(),
    session_id: t.Number(),
    campaign_subject_id: t.Number(),
    session_subject_id: t.Number(),
    session_subject_question_id: t.Number(),
});

export const updateAssignmentBodySchema = t.Object({
    active: t.Boolean(),
});
