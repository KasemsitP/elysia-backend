import type { Static } from "elysia";
import { sessionQuerySchema, sessionCreateBodySchema } from "./sessions.schema";


export type sessionQuerySchema = Static<typeof sessionQuerySchema>;
export type sessionCreateBodySchema = Static<typeof sessionCreateBodySchema>







