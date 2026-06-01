import type { Static } from "elysia";
import type {
    scoreResetCampaignParamSchema,
    scoreResetCaseParamSchema,
    scoreResetCasesQuerySchema,
    scoreResetVerifyScanBodySchema,
    scoreResetConfirmBodySchema,
} from "./score-reset.schema";

export type ScoreResetCampaignParam = Static<typeof scoreResetCampaignParamSchema>;
export type ScoreResetCaseParam = Static<typeof scoreResetCaseParamSchema>;
export type ScoreResetCasesQuery = Static<typeof scoreResetCasesQuerySchema>;
export type ScoreResetVerifyScanBody = Static<typeof scoreResetVerifyScanBodySchema>;
export type ScoreResetConfirmBody = Static<typeof scoreResetConfirmBodySchema>;
