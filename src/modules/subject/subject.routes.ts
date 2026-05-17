import { Elysia } from "elysia";
import { subjectService } from "./subject.service";
import { requireSession } from "../../cores/session";
import {
    subjectIdParamSchema,
    createSubjectBodySchema,
    updateSubjectBodySchema,
} from "./subject.schema";

export const subjectRoutes = new Elysia({ prefix: "/subjects" })
    .use(requireSession)
    .get("/", async ({ set }) => {
        set.status = 200;
        return subjectService.findAll();
    })
    .get("/:subjectId", async ({ params, set }) => {
        set.status = 200;
        return subjectService.findById(params.subjectId);
    }, { params: subjectIdParamSchema })
    .post("/", async ({ body, set }) => {
        set.status = 201;
        return subjectService.create(body);
    }, { body: createSubjectBodySchema })
    .patch("/:subjectId", async ({ params, body, set }) => {
        set.status = 200;
        return subjectService.update(params.subjectId, body);
    }, { params: subjectIdParamSchema, body: updateSubjectBodySchema })
    .delete("/:subjectId", async ({ params, set }) => {
        set.status = 200;
        return subjectService.delete(params.subjectId);
    }, { params: subjectIdParamSchema });
