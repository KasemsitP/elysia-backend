
import { t } from "elysia";




export const sessionQuerySchema = t.Object({
    session_id: t.Numeric()
})

export const campaignQuerySchema = t.Object({
    campaign_id: t.Numeric()
})



export const sessionCreateBodySchema = t.Object({
    campaign_id: t.Numeric(),
    session_code: t.String(),
    title: t.String(),
    exam_date: t.Date(),
    day_no: t.Numeric(),

})
