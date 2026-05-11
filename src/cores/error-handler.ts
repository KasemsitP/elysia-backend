import { Elysia } from "elysia";
import { AppError } from "./errors";

function thaiValidationMessage(e: { type: number; schema: any; path: string }): string {
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

export const errorHandler = new Elysia({ name: "error-handler" }).onError(
    { as: "global" },
    ({ code, error, set }) => {
        if (code === "VALIDATION") {
            set.status = 422;
            return {
                success: false,
                message: "กรุณากรอกข้อมูลให้ถูกต้อง",
                errors: error.all.map((e) => ({
                    field: e.path.replace("/", ""),
                    message: thaiValidationMessage(e),
                })),
            };
        }

        if (code === "NOT_FOUND") {
            set.status = 404;
            return {
                success: false,
                message: "ไม่พบข้อมูลที่ร้องขอ",
            };
        }

        if (error instanceof AppError) {
            set.status = error.statusCode;
            return {
                success: false,
                message: error.message,
            };
        }

        console.error("[500]", error);
        set.status = 500;
        return {
            success: false,
            message: "เกิดข้อผิดพลาดภายในระบบ",
        };
    }
);
