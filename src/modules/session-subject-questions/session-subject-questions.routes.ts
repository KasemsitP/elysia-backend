import { Elysia } from "elysia";
import { sessionSubjectQuestionService } from "./session-subject-questions.service";
import { requireSession } from "../../cores/session";
import {
    sessionQuestionsParamSchema,
    sessionSubjectIdParamSchema,
    questionIdParamSchema,
    createQuestionBodySchema,
    updateQuestionBodySchema,
} from "./session-subject-questions.schema";

export const sessionSubjectQuestionRoutes = new Elysia()
    .use(requireSession)
    .get(
        "/campaigns/:campaignId/sessions/:sessionId/questions",
        async ({ params, set }) => {
            set.status = 200;
            return sessionSubjectQuestionService.findBySession(params.campaignId, params.sessionId);
        },
        { params: sessionQuestionsParamSchema },
    )
    .get(
        "/session-subjects/:sessionSubjectId/questions",
        async ({ params, set }) => {
            set.status = 200;
            return sessionSubjectQuestionService.findBySessionSubject(params.sessionSubjectId);
        },
        { params: sessionSubjectIdParamSchema },
    )
    .post(
        "/session-subjects/:sessionSubjectId/questions",
        async ({ params, body, set }) => {
            set.status = 201;
            return sessionSubjectQuestionService.create(params.sessionSubjectId, body);
        },
        { params: sessionSubjectIdParamSchema, body: createQuestionBodySchema },
    )
    .post(
        "/session-subjects/:sessionSubjectId/questions/import-from-template",
        async ({ params, set }) => {
            set.status = 201;
            return sessionSubjectQuestionService.importFromTemplate(params.sessionSubjectId);
        },
        { params: sessionSubjectIdParamSchema },
    )
    .patch(
        "/session-subject-questions/:questionId",
        async ({ params, body, set }) => {
            set.status = 200;
            return sessionSubjectQuestionService.update(params.questionId, body);
        },
        { params: questionIdParamSchema, body: updateQuestionBodySchema },
    )
    .delete(
        "/session-subject-questions/:questionId",
        async ({ params, set }) => {
            set.status = 200;
            return sessionSubjectQuestionService.delete(params.questionId);
        },
        { params: questionIdParamSchema },
    );
