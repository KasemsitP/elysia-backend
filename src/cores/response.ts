export const ok = <T>(data: T, message = "สำเร็จ") => ({
    success: true as const,
    message,
    data,
});

export const created = <T>(data: T, message = "สร้างสำเร็จ") => ({
    success: true as const,
    message,
    data,
});

export const deleted = (message = "ลบสำเร็จ") => ({
    success: true as const,
    message,
});
