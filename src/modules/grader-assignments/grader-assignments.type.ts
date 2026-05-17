import type { Static } from "elysia";
import type {
    assignmentCampaignParamSchema,
    assignmentGraderParamSchema,
    assignmentIdParamSchema,
    createAssignmentBodySchema,
    updateAssignmentBodySchema,
} from "./grader-assignments.schema";

export type AssignmentCampaignParam = Static<typeof assignmentCampaignParamSchema>;
export type AssignmentGraderParam = Static<typeof assignmentGraderParamSchema>;
export type AssignmentIdParam = Static<typeof assignmentIdParamSchema>;
export type CreateAssignmentBody = Static<typeof createAssignmentBodySchema>;
export type UpdateAssignmentBody = Static<typeof updateAssignmentBodySchema>;
