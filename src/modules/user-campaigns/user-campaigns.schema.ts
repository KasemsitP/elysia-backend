import { t } from "elysia";

export const candidateCampaignParamSchema = t.Object({
    campaignId: t.Numeric(),
});

export const candidateParamSchema = t.Object({
    campaignId: t.Numeric(),
    userCampaignId: t.Numeric(),
});

export const sessionCandidateParentSchema = t.Object({
    campaignId: t.Numeric(),
    sessionId: t.Numeric(),
});

export const sessionCandidateParamSchema = t.Object({
    campaignId: t.Numeric(),
    sessionId: t.Numeric(),
    userSessionId: t.Numeric(),
});

export const createCandidateBodySchema = t.Object({
    user_id: t.Number(),
    room_code: t.Optional(t.Nullable(t.String())),
    row_no: t.Optional(t.Nullable(t.Number())),
    col_no: t.Optional(t.Nullable(t.Number())),
});

export const updateCandidateBodySchema = t.Object({
    room_code: t.Optional(t.Nullable(t.String())),
    row_no: t.Optional(t.Nullable(t.Number())),
    col_no: t.Optional(t.Nullable(t.Number())),
});

export const createSessionCandidateBodySchema = t.Object({
    user_campaign_id: t.Number(),
});
