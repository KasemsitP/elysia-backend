import { Elysia } from "elysia";
import { Prisma } from "../generated/prisma/client";
import { AppError } from "./errors";
import { logger } from "./logger";

function thaiValidationMessage(e: { type: number; schema: { minLength?: number; maxLength?: number }; path: string }): string {
    const field = e.path.replace("/", "");
    switch (e.type) {
        case 52: return `${field} ต้องมีความยาวอย่างน้อย ${e.schema.minLength} ตัวอักษร`;
        case 53: return `${field} ต้องมีความยาวไม่เกิน ${e.schema.maxLength} ตัวอักษร`;
        case 45: return `${field} ต้องเป็นตัวเลข`;
        case 44: return `${field} ต้องเป็นข้อความ`;
        case 54: return `${field} รูปแบบไม่ถูกต้อง`;
        case 48: return `ไม่พบ field: ${field}`;
        default: return `${field} ข้อมูลไม่ถูกต้อง`;
    }
}

// Standard error response shape ทุก module เหมือนกัน
function errorResponse(status: number, message: string, errors?: unknown) {
    return {
        success: false as const,
        message,
        ...(errors !== undefined && { errors }),
    };
}

export const errorHandler = new Elysia({ name: "error-handler" })
    .onError({ as: "global" }, ({ code, error, set, request }) => {
        const method = request.method;
        const path = new URL(request.url).pathname;
        const err = error as unknown;

        if (code === "VALIDATION") {
            set.status = 422;
            logger.warn(`[422] VALIDATION ${method} ${path}`);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return errorResponse(422, "กรุณากรอกข้อมูลให้ถูกต้อง", (error as any).all?.map((e: { path: string; type: number; schema: { minLength?: number; maxLength?: number } }) => ({
                field: e.path.replace("/", ""),
                message: thaiValidationMessage(e),
            })));
        }

        if (code === "NOT_FOUND") {
            set.status = 404;
            return errorResponse(404, "ไม่พบข้อมูลที่ร้องขอ");
        }

        if (err instanceof Prisma.PrismaClientKnownRequestError) {
            if (err.code === "P2002") {
                set.status = 409;
                logger.warn(`[409] P2002 ${method} ${path}: ${err.message}`);
                return errorResponse(409, "ข้อมูลซ้ำ กรุณาตรวจสอบและลองใหม่");
            }
            if (err.code === "P2025") {
                set.status = 404;
                return errorResponse(404, "ไม่พบข้อมูลที่ต้องการ");
            }
            logger.error(`[500] Prisma ${err.code} ${method} ${path}`, err);
            set.status = 500;
            return errorResponse(500, "เกิดข้อผิดพลาดภายในระบบ");
        }

        if (err instanceof AppError) {
            set.status = err.statusCode;
            if (err.statusCode >= 500) {
                logger.error(`[${err.statusCode}] AppError ${method} ${path}`, err);
            } else {
                logger.warn(`[${err.statusCode}] ${method} ${path}: ${err.message}`);
            }
            return errorResponse(err.statusCode, err.message);
        }

        // Unhandled — log full error
        logger.error(`[500] Unhandled ${method} ${path}`, err);
        set.status = 500;
        return errorResponse(500, "เกิดข้อผิดพลาดภายในระบบ");
    });
