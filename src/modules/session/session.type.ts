import type { Static } from "elysia";
import type {
    sessionCampaignParamSchema,
    sessionParamSchema,
    createSessionBodySchema,
    updateSessionBodySchema,
} from "./sessions.schema";

export type SessionCampaignParam = Static<typeof sessionCampaignParamSchema>;
export type SessionParam = Static<typeof sessionParamSchema>;
export type CreateSessionBody = Static<typeof createSessionBodySchema>;
export type UpdateSessionBody = Static<typeof updateSessionBodySchema>;
