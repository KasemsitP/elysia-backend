import { Elysia } from "elysia";
import { sessionSubjectService } from "./session-subjects.service";
import { requireSession } from "../../cores/session";
import {
    sessionSubjectParentParamSchema,
    sessionSubjectParamSchema,
    createSessionSubjectBodySchema,
    updateSessionSubjectBodySchema,
} from "./session-subjects.schema";

export const sessionSubjectRoutes = new Elysia({ prefix: "/campaigns/:campaignId/sessions/:sessionId/subjects" })
    .use(requireSession)
    .get("/", async ({ params, set }) => {
        set.status = 200;
        return sessionSubjectService.findBySession(params.campaignId, params.sessionId);
    }, { params: sessionSubjectParentParamSchema })
    .post("/", async ({ params, body, set }) => {
        set.status = 201;
        return sessionSubjectService.create(params.campaignId, params.sessionId, body);
    }, { params: sessionSubjectParentParamSchema, body: createSessionSubjectBodySchema })
    .patch("/:sessionSubjectId", async ({ params, body, set }) => {
        set.status = 200;
        return sessionSubjectService.update(params.campaignId, params.sessionId, params.sessionSubjectId, body);
    }, { params: sessionSubjectParamSchema, body: updateSessionSubjectBodySchema })
    .delete("/:sessionSubjectId", async ({ params, set }) => {
        set.status = 200;
        return sessionSubjectService.delete(params.campaignId, params.sessionId, params.sessionSubjectId);
    }, { params: sessionSubjectParamSchema });
