import type { Static } from "elysia";
import type {
    incidentIdParamSchema,
    incidentQuerySchema,
    createIncidentBodySchema,
    updateIncidentBodySchema,
    updateIncidentStatusBodySchema,
} from "./incidents.schema";

export type IncidentIdParam = Static<typeof incidentIdParamSchema>;
export type IncidentQuery = Static<typeof incidentQuerySchema>;
export type CreateIncidentBody = Static<typeof createIncidentBodySchema>;
export type UpdateIncidentBody = Static<typeof updateIncidentBodySchema>;
export type UpdateIncidentStatusBody = Static<typeof updateIncidentStatusBodySchema>;
