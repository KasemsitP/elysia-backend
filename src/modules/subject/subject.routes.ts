import { Elysia } from "elysia";
import { subjectService } from "./subject.service";
import { requireSession } from "../../cores/session";
import { requireAdmin } from "../../cores/auth-guard";
import {
    subjectIdParamSchema,
    createSubjectBodySchema,
    updateSubjectBodySchema,
} from "./subject.schema";

const readRoutes = new Elysia({ prefix: "/subjects" })
    .use(requireSession)
    .get("/", ({ set }) => { set.status = 200; return subjectService.findAll(); })
    .get("/:subjectId", ({ params, set }) => {
        set.status = 200; return subjectService.findById(params.subjectId);
    }, { params: subjectIdParamSchema });

const writeRoutes = new Elysia({ prefix: "/subjects" })
    .use(requireAdmin())
    .post("/", ({ body, set }) => { set.status = 201; return subjectService.create(body); }, { body: createSubjectBodySchema })
    .patch("/:subjectId", ({ params, body, set }) => {
        set.status = 200; return subjectService.update(params.subjectId, body);
    }, { params: subjectIdParamSchema, body: updateSubjectBodySchema })
    .delete("/:subjectId", ({ params, set }) => {
        set.status = 200; return subjectService.delete(params.subjectId);
    }, { params: subjectIdParamSchema });

export const subjectRoutes = new Elysia().use(readRoutes).use(writeRoutes);
