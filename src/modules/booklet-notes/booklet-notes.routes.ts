import { Elysia } from "elysia";
import { bookletNoteService } from "./booklet-notes.service";
import { requireSession } from "../../cores/session";
import {
    bookletNoteParentParamSchema,
    bookletNoteIdParamSchema,
    createNoteBodySchema,
    updateNoteBodySchema,
    reviewNoteBodySchema,
} from "./booklet-notes.schema";

export const bookletNoteRoutes = new Elysia()
    .use(requireSession)
    .get(
        "/booklets/:bookletId/question-notes",
        ({ params, set }) => {
            set.status = 200;
            return bookletNoteService.findByBooklet(params.bookletId);
        },
        { params: bookletNoteParentParamSchema },
    )
    .post(
        "/booklets/:bookletId/question-notes",
        ({ params, body, session, set }) => {
            set.status = 201;
            return bookletNoteService.create(params.bookletId, body, session);
        },
        { params: bookletNoteParentParamSchema, body: createNoteBodySchema },
    )
    .patch(
        "/booklet-question-notes/:noteId",
        ({ params, body, set }) => {
            set.status = 200;
            return bookletNoteService.update(params.noteId, body);
        },
        { params: bookletNoteIdParamSchema, body: updateNoteBodySchema },
    )
    .patch(
        "/booklet-question-notes/:noteId/review",
        ({ params, body, session, set }) => {
            set.status = 200;
            return bookletNoteService.review(params.noteId, body, session);
        },
        { params: bookletNoteIdParamSchema, body: reviewNoteBodySchema },
    )
    .delete(
        "/booklet-question-notes/:noteId",
        ({ params, set }) => {
            set.status = 200;
            return bookletNoteService.delete(params.noteId);
        },
        { params: bookletNoteIdParamSchema },
    );
