import { Elysia } from "elysia";
import { graderAssignmentService } from "./grader-assignments.service";
import { requireSession } from "../../cores/session";
import {
    assignmentCampaignParamSchema,
    assignmentGraderParamSchema,
    assignmentIdParamSchema,
    createAssignmentBodySchema,
    updateAssignmentBodySchema,
} from "./grader-assignments.schema";

export const graderAssignmentRoutes = new Elysia()
    .use(requireSession)
    .get(
        "/campaigns/:campaignId/grader-assignments",
        ({ params, set }) => {
            set.status = 200;
            return graderAssignmentService.findByCampaign(params.campaignId);
        },
        { params: assignmentCampaignParamSchema },
    )
    .get(
        "/graders/:graderId/assignments",
        ({ params, set }) => {
            set.status = 200;
            return graderAssignmentService.findByGrader(params.graderId);
        },
        { params: assignmentGraderParamSchema },
    )
    .post(
        "/campaigns/:campaignId/grader-assignments",
        ({ params, body, set }) => {
            set.status = 201;
            return graderAssignmentService.create(params.campaignId, body);
        },
        { params: assignmentCampaignParamSchema, body: createAssignmentBodySchema },
    )
    .patch(
        "/grader-assignments/:assignmentId",
        ({ params, body, set }) => {
            set.status = 200;
            return graderAssignmentService.update(params.assignmentId, body);
        },
        { params: assignmentIdParamSchema, body: updateAssignmentBodySchema },
    )
    .delete(
        "/grader-assignments/:assignmentId",
        ({ params, set }) => {
            set.status = 200;
            return graderAssignmentService.delete(params.assignmentId);
        },
        { params: assignmentIdParamSchema },
    );
