import type { Static } from "elysia";
import { loginBodySchema, registerBodySchenma, accountIdParamsSchema, meQuerySchema, revokeQuerySchema, unRevokeQuerySchema, } from "./auth.schema";


export type LoginBodySchema = Static<typeof loginBodySchema>;
export type RegisterBodySchema = Static<typeof registerBodySchenma>;
export type AccountIdParamsSchema = Static<typeof accountIdParamsSchema>;
export type RevokeQuerySchema = Static<typeof revokeQuerySchema>;
export type UnRevokeQuerySchema = Static<typeof unRevokeQuerySchema>;
export type MeQuerySchema = Static<typeof meQuerySchema>;


export type AuthAccountResponse = {
    id: number,
    username: string,
    role: "ADMIN" | "MANAGER" | "GRADER" | "STAFF",
    full_name: string;
    email?: string,
}

type GraderResponse = {
    id: number,
    account_id: number | null,
    campaign_id: number | null,
}

export type AuthAccountGraderResponse = {
    id: number,
    username: string,
    role: "ADMIN" | "MANAGER" | "GRADER" | "STAFF",
    full_name: string;
    email?: string,
    campaign_id: number | null,
    grader: GraderResponse,
}

export type AuthLoginResponse = {
    message: string,
    account: AuthAccountResponse,
}

export type AuthRegisterResponse = {
    message: string,
    account: AuthAccountResponse,
}

export type AuthLogoutResponse = {
    message: string,
}

export type AuthRevokeResponse = {
    message: string,
    account: AuthAccountResponse,
}

export type AuthUnRevokeResponse = {
    message: string,
    account: AuthAccountResponse,
}

export type AuthMeResponse = {
    message: string,
    account: AuthAccountResponse,
}

export type SessionData = {
    account_id: number;
    role_id: number;
    username: string;
    full_name: string;
    email: string | null;
    grader_id: number | null;
    campaign_id: number | null;
};