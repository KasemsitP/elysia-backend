import { t } from "elysia";


export const loginBodySchema = t.Object({
    username: t.String(),
    password: t.String({ minLength: 8 })
})



export const registerBodySchenma = t.Object({
    username: t.String(),
    password: t.String({ minLength: 8 }),
    verify_password: t.String({ minLength: 8 }),
    full_name: t.String(),
    title: t.String(),
    email: t.String(),
    role_id: t.Numeric(),
    manager_order: t.Optional(t.Nullable(t.Number())),
    campaign_id: t.Optional(t.Nullable(t.Number()))
});

export const accountIdParamsSchema = t.Object({
    id: t.String(),

})

export const meQuerySchema = t.Object({
    id: t.String(),
})
export const revokeQuerySchema = t.Object({
    id: t.String(),
})
export const unRevokeQuerySchema = t.Object({
    id: t.String(),
})
