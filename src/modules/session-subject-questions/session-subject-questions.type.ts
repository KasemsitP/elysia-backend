import type { Static } from "elysia";
import type {
    sessionQuestionsParamSchema,
    sessionSubjectIdParamSchema,
    questionIdParamSchema,
    createQuestionBodySchema,
    updateQuestionBodySchema,
} from "./session-subject-questions.schema";

export type SessionQuestionsParam = Static<typeof sessionQuestionsParamSchema>;
export type SessionSubjectIdParam = Static<typeof sessionSubjectIdParamSchema>;
export type QuestionIdParam = Static<typeof questionIdParamSchema>;
export type CreateQuestionBody = Static<typeof createQuestionBodySchema>;
export type UpdateQuestionBody = Static<typeof updateQuestionBodySchema>;
