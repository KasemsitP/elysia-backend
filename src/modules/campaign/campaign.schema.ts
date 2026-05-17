
import { t } from "elysia";




export const campaignQuerySchema = t.Object({
    campaign_id: t.Numeric()
})

export const updateBodySchema = t.Object({
    year_be: t.String(),
    site: t.String(),
    campaign_size: t.String(),
})

export const createBodySchema = t.Object({
    name: t.String(),
    code: t.String(),
    is_active: t.Boolean(),
    year_be: t.String(),
    site: t.String(),
    is_unlock: t.Boolean(),
    campaign_size: t.String(),
    qr_active: t.Boolean(),
})

