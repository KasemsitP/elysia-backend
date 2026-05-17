import { Elysia } from "elysia";
import { openapi } from "@elysia/openapi";
import { cors } from "@elysia/cors";
import { logger } from "@grotto/logysia";
import { errorHandler } from "./cores/error-handler";
import { authRoutes } from "./modules/auth/auth.routes";
import { subjectRoutes } from "./modules/subject/subject.routes";
import { campaignRoutes } from "./modules/campaign/campaign.routes";
import { campaignSubjectRoutes } from "./modules/campaign-subjects/campaign-subjects.routes";
import { sessionRoutes } from "./modules/session/session.routes";
import { sessionSubjectRoutes } from "./modules/session-subjects/session-subjects.routes";
import { sessionSubjectQuestionRoutes } from "./modules/session-subject-questions/session-subject-questions.routes";
import { graderRoutes } from "./modules/grader/grader.routes";
import { graderAssignmentRoutes } from "./modules/grader-assignments/grader-assignments.routes";
import { bookletRoutes } from "./modules/booklets/booklets.routes";
import { bagRoutes } from "./modules/bags/bags.routes";
import { gradingRoutes } from "./modules/grading/grading.routes";
import { reportRoutes } from "./modules/reports/reports.routes";
import { incidentRoutes } from "./modules/incidents/incidents.routes";
import { bookletNoteRoutes } from "./modules/booklet-notes/booklet-notes.routes";
import { otpRoutes } from "./modules/otp/otp.routes";
import { notificationRoutes } from "./modules/notifications/notifications.routes";

export const app = new Elysia({ prefix: "/api" })
    .use(openapi())
    .use(logger())
    .use(cors())
    .use(errorHandler)
    .get("/", () => ({ message: "Elysia is running" }))
    .use(authRoutes)
    .use(subjectRoutes)
    .use(campaignRoutes)
    .use(campaignSubjectRoutes)
    .use(sessionRoutes)
    .use(sessionSubjectRoutes)
    .use(sessionSubjectQuestionRoutes)
    .use(graderRoutes)
    .use(graderAssignmentRoutes)
    .use(bookletRoutes)
    .use(bagRoutes)
    .use(gradingRoutes)
    .use(reportRoutes)
    .use(incidentRoutes)
    .use(bookletNoteRoutes)
    .use(otpRoutes)
    .use(notificationRoutes);

export type App = typeof app;
