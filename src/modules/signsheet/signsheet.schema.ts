import { t } from "elysia";

export const signsheetParamSchema = t.Object({
    campaignId: t.Numeric(),
    sessionId:  t.Numeric(),
});

export const signsheetQuerySchema = t.Object({
    page:   t.Optional(t.Numeric()),
    limit:  t.Optional(t.Numeric()),
    search: t.Optional(t.String()),
});

export const signsheetPdfQuerySchema = t.Object({
    search: t.Optional(t.String()),
});
