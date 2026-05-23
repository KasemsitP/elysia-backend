import { randomBytes } from "crypto";
import { authRepo } from "./auth.repo";
import { AppError } from "../../cores/errors";
import { prisma } from "../../cores/prisma";
import type {
    LoginBodySchema,
    RegisterBodySchema,
    AuthAccountResponse,
    RevokeQuerySchema,
    UnRevokeQuerySchema,
    SessionData,
    AuthAccountGraderResponse,
} from "./auth.type";
import { graderRepo } from "../grader/grader.repo";

const SESSION_TTL_SECONDS = 60 * 60 * 24; // 24 hours


function decodeRole(role_id: number): "ADMIN" | "MANAGER" | "GRADER" | "STAFF" {
    switch (role_id) {
        case 1: return "ADMIN";
        case 2: return "STAFF";
        case 3: return "MANAGER";
        case 4: return "GRADER";
        default: throw new AppError("Invalid role", 500);
    }
}

function toAuthAccountResponse(account: {
    id: number;
    email?: string | null;
    role_id: number;
    full_name: string;
    username: string;
    manager_order?: number | null;
}): AuthAccountResponse {
    return {
        id: account.id,
        email: account.email ?? undefined,
        role: decodeRole(account.role_id),
        full_name: account.full_name,
        username: account.username,
        manager_order: account.manager_order ?? null,
    };
}

function toAuthAccountGraderResponse(account: {
    id: number;
    email?: string | null;
    role_id: number;
    full_name: string;
    username: string;
    campaign_id?: number | null;
    manager_order?: number | null;
}, grader: {
    id: number;
    account_id: number | null;
    campaign_id: number | null;
}): AuthAccountGraderResponse {
    return {
        id: account.id,
        email: account.email ?? undefined,
        role: decodeRole(account.role_id),
        full_name: account.full_name,
        username: account.username,
        campaign_id: account.campaign_id ?? null,
        grader: {
            id: grader.id,
            account_id: grader.account_id,
            campaign_id: grader.campaign_id,
        },
        manager_order: account.manager_order ?? null,
    };
}

export const authService = {
    async login(input: LoginBodySchema) {
        // Lazy cleanup: ลบ session หมดอายุทุกครั้งที่มี login ใหม่ (non-blocking)
        authRepo.deleteExpiredSessions().catch(() => null);

        const account = await authRepo.findAccountByUsername(input.username);
        if (!account) {
            throw new AppError("ไม่พบผู้ใช้", 401);
        }

        if (account.active === false) {
            throw new AppError("บัญชีถูกปิดใช้งาน", 401);
        }

        const isPasswordValid = Bun.password.verifySync(input.password, account.password_hash);
        if (!isPasswordValid) {
            throw new AppError("รหัสผ่านไม่ถูกต้อง", 401);
        }

        const isGrader = account.role_id === 4;
        let grader_id: number | null = null;

        if (isGrader) {
            const grader = await graderRepo.getGraderByAccountId(account.id);
            if (!grader) {
                throw new AppError("ไม่พบข้อมูลผู้ตรวจ", 404);
            }
            grader_id = grader.id;
        }

        const sid = randomBytes(64).toString("hex");
        const expires = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
        const sessionData: SessionData = {
            account_id: account.id,
            role_id: account.role_id,
            username: account.username,
            full_name: account.full_name,
            email: account.email ?? null,
            grader_id,
            campaign_id: account.campaign_id ?? null,
        };

        await authRepo.createSession({
            sid,
            account_id: account.id,
            expires,
            data: JSON.stringify(sessionData),
        });

        const accountResponse = isGrader
            ? toAuthAccountGraderResponse(account, { id: grader_id!, account_id: account.id, campaign_id: account.campaign_id ?? null  })
            : toAuthAccountResponse(account);

        return { sid, message: "ล็อคอินสำเร็จ", account: accountResponse };
    },

    async logout(sid: string) {
        await authRepo.deleteSession(sid);
    },
    async register(input: RegisterBodySchema) {
        const accountFound = await authRepo.findAccountByUsername(input.username);
        if (accountFound) {
            throw new AppError("ชื่อผู้ใช้ถูกใช้งานแล้ว", 409);

        }
        if (input.password !== input.verify_password) {
            throw new AppError("รหัสผ่านไม่ตรงกัน", 409);
        }
        const hashedPassword = Bun.password.hashSync(input.password);


        const isGrader = input.role_id === 4;



        if (isGrader && input.campaign_id == null) {
            throw new AppError("กรุณาระบุ campaign_id สำหรับผู้ตรวจ", 400);
        }

        const accountCreated = await prisma.$transaction(async (tx) => {
            const account = await authRepo.createAccount({
                username: input.username,
                password_hash: hashedPassword,
                full_name: input.full_name,
                email: input.email,
                role_id: input.role_id,
                manager_order: input.manager_order ?? null,
                title: input.title,
                campaign_id: input.campaign_id ?? null,
            }, tx);

            if (isGrader && input.campaign_id != null) {
                await graderRepo.createGrader(account.id, input.campaign_id, tx);
            }

            return account;
        });

        return {
            message: "สร้างผู้ใช้สำเร็จ",
            account: toAuthAccountResponse(accountCreated),
        }

    },

    async revokeAccount(input: RevokeQuerySchema) {
        const accountFound = await authRepo.findAccountById(input.id);
        if (!accountFound) {
            throw new AppError("ไม่พบผู้ใช้", 404);
        }
        await authRepo.revokeAccount(input.id);
        return {
            message: "ถอนสิทธิ์ผู้ใช้สำเร็จ",
            account: toAuthAccountResponse(accountFound),
        }
    },

    async unRevokeAccount(input: UnRevokeQuerySchema) {
        const accountFound = await authRepo.findAccountById(input.id);
        if (!accountFound) {
            throw new AppError("ไม่พบผู้ใช้", 404);
        }
        await authRepo.unRevokeAccount(input.id);
        return {
            message: "คืนสิทธิ์ผู้ใช้สำเร็จ",
            account: toAuthAccountResponse(accountFound),
        }
    },

    async me(accountId: number) {
        const accountFound = await authRepo.findAccountById(String(accountId));
        if (!accountFound) {
            throw new AppError("ไม่พบผู้ใช้", 404);
        }
        return {
            message: "พบข้อมูลผู้ใช้",
            account: toAuthAccountResponse(accountFound),
        }
    },

}
