import { authRepo } from "./auth.repo";
import { AppError } from "../../cores/errors";
import type {
    LoginBodySchema,
    RegisterBodySchema,
    AuthAccountResponse,
    RevokeQuerySchema,
    UnRevokeQuerySchema,
    MeQuerySchema,
    AuthAccountGraderResponse
} from "./auth.type";
import { graderRepo } from "../grader/grader.repo";


function decodeRole(role_id: string): "ADMIN" | "MANAGER" | "GRADER" | "STAFF" {
    switch (role_id) {
        case "1": return "ADMIN";
        case "2": return "STAFF";
        case "3": return "MANAGER";
        case "4": return "GRADER";
        default: throw new AppError("Invalid role", 500);
    }
}

function toAuthAccountResponse(account: {
    id: string;
    email?: string | null;
    role_id: string;
    full_name: string;
    username: string;
}): AuthAccountResponse {
    return {
        id: account.id,
        email: account.email ?? undefined,
        role: decodeRole(account.role_id),
        full_name: account.full_name,
        username: account.username,
    };
}

function toAuthAccountGraderResponse(account: {
    id: string;
    email?: string | null;
    role_id: string;
    full_name: string;
    username: string;
    campaign_id?: number | null;
}, grader: {
    id: string;
    account_id: string | null;
    campaign_id: string | null;
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
        }
    };
}

export const authService = {
    async login(input: LoginBodySchema) {
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
        const isGrader = account.role_id === "4";

        if (isGrader) {
            const grader = await graderRepo.getGraderByAccountId(account.id);
            if (!grader) {
                throw new AppError("ไม่พบข้อมูลผู้ตรวจ", 404);
            }
            return {
                message: "ล็อคอินสำเร็จ",
                account: toAuthAccountGraderResponse(account, grader),
            }
        }







        // session or jwt here


        return {
            message: "ล็อคอินสำเร็จ",
            account: toAuthAccountResponse(account),
        }

    },
    async logout() {

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
        const accountCreated = await authRepo.createAccount({
            username: input.username,
            password_hash: hashedPassword,
            full_name: input.full_name,
            email: input.email,
            role_id: input.role_id,
            manager_order: input.manager_order ?? null,
            title: input.title,
            campaign_id: input.campaign_id ?? null,
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

    async me(input: MeQuerySchema) {
        const accountFound = await authRepo.findAccountById(input.id);
        if (!accountFound) {
            throw new AppError("ไม่พบผู้ใช้", 404);
        }
        return {
            message: "พบข้อมูลผู้ใช้",
            account: toAuthAccountResponse(accountFound),
        }
    },

}
