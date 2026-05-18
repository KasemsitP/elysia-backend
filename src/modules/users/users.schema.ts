import { t } from "elysia";

export const userIdParamSchema = t.Object({
    userId: t.Numeric(),
});

export const userQuerySchema = t.Object({
    search: t.Optional(t.String()),
    page: t.Optional(t.Numeric()),
    limit: t.Optional(t.Numeric()),
});

export const createUserBodySchema = t.Object({
    user_code: t.String(),
    full_name: t.String(),
    title: t.Optional(t.Nullable(t.String())),
    gender: t.Optional(t.Nullable(t.String())),
    first_name: t.Optional(t.Nullable(t.String())),
    last_name: t.Optional(t.Nullable(t.String())),
    first_name_en: t.Optional(t.Nullable(t.String())),
    last_name_en: t.Optional(t.Nullable(t.String())),
    national_id: t.Optional(t.Nullable(t.String())),
    birth_date: t.Optional(t.Nullable(t.String())),
    email: t.Optional(t.Nullable(t.String())),
    phone: t.Optional(t.Nullable(t.String())),
    mobile: t.Optional(t.Nullable(t.String())),
    address: t.Optional(t.Nullable(t.String())),
    study_degree: t.Optional(t.Nullable(t.String())),
    university: t.Optional(t.Nullable(t.String())),
    ethnicity: t.Optional(t.Nullable(t.String())),
    nationality_birth: t.Optional(t.Nullable(t.String())),
    nationality_current: t.Optional(t.Nullable(t.String())),
    religion: t.Optional(t.Nullable(t.String())),
});

export const updateUserBodySchema = t.Object({
    full_name: t.Optional(t.String()),
    title: t.Optional(t.Nullable(t.String())),
    gender: t.Optional(t.Nullable(t.String())),
    first_name: t.Optional(t.Nullable(t.String())),
    last_name: t.Optional(t.Nullable(t.String())),
    first_name_en: t.Optional(t.Nullable(t.String())),
    last_name_en: t.Optional(t.Nullable(t.String())),
    national_id: t.Optional(t.Nullable(t.String())),
    birth_date: t.Optional(t.Nullable(t.String())),
    email: t.Optional(t.Nullable(t.String())),
    phone: t.Optional(t.Nullable(t.String())),
    mobile: t.Optional(t.Nullable(t.String())),
    address: t.Optional(t.Nullable(t.String())),
    study_degree: t.Optional(t.Nullable(t.String())),
    university: t.Optional(t.Nullable(t.String())),
});

export const importUsersBodySchema = t.Object({
    users: t.Array(createUserBodySchema, { minItems: 1 }),
});
