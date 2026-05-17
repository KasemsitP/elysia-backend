import { Elysia } from "elysia";
import { incidentService } from "./incidents.service";
import { requireSession } from "../../cores/session";
import {
    incidentIdParamSchema,
    incidentQuerySchema,
    createIncidentBodySchema,
    updateIncidentBodySchema,
    updateIncidentStatusBodySchema,
} from "./incidents.schema";

export const incidentRoutes = new Elysia({ prefix: "/incidents" })
    .use(requireSession)
    .get(
        "/",
        ({ query, set }) => {
            set.status = 200;
            return incidentService.findAll(query);
        },
        { query: incidentQuerySchema },
    )
    .get(
        "/:incidentId",
        ({ params, set }) => {
            set.status = 200;
            return incidentService.findById(params.incidentId);
        },
        { params: incidentIdParamSchema },
    )
    .post(
        "/",
        ({ body, session, set }) => {
            set.status = 201;
            return incidentService.create(body, session);
        },
        { body: createIncidentBodySchema },
    )
    .patch(
        "/:incidentId",
        ({ params, body, set }) => {
            set.status = 200;
            return incidentService.update(params.incidentId, body);
        },
        { params: incidentIdParamSchema, body: updateIncidentBodySchema },
    )
    .patch(
        "/:incidentId/status",
        ({ params, body, session, set }) => {
            set.status = 200;
            return incidentService.updateStatus(params.incidentId, body, session);
        },
        { params: incidentIdParamSchema, body: updateIncidentStatusBodySchema },
    )
    .delete(
        "/:incidentId",
        ({ params, set }) => {
            set.status = 200;
            return incidentService.delete(params.incidentId);
        },
        { params: incidentIdParamSchema },
    );
