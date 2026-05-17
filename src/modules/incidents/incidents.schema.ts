import { t } from "elysia";

export const incidentIdParamSchema = t.Object({
    incidentId: t.Numeric(),
});

export const incidentQuerySchema = t.Object({
    campaign_id: t.Optional(t.Numeric()),
    session_id: t.Optional(t.Numeric()),
    status: t.Optional(t.String()),
});

export const createIncidentBodySchema = t.Object({
    campaign_id: t.Number(),
    session_id: t.Number(),
    bag_id: t.Optional(t.Nullable(t.Number())),
    booklet_id: t.Optional(t.Nullable(t.Number())),
    incident_type: t.String(),
    severity: t.Optional(t.Union([t.Literal("LOW"), t.Literal("MEDIUM"), t.Literal("HIGH"), t.Literal("CRITICAL")])),
    title: t.String(),
    description: t.String(),
});

export const updateIncidentBodySchema = t.Object({
    incident_type: t.Optional(t.String()),
    severity: t.Optional(t.String()),
    title: t.Optional(t.String()),
    description: t.Optional(t.String()),
    assigned_to_account_id: t.Optional(t.Nullable(t.Number())),
});

export const updateIncidentStatusBodySchema = t.Object({
    status: t.Union([t.Literal("OPEN"), t.Literal("IN_REVIEW"), t.Literal("RESOLVED"), t.Literal("CLOSED")]),
    resolution_note: t.Optional(t.Nullable(t.String())),
});
