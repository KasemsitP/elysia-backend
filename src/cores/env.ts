import "dotenv/config";

export const env = {
    DATABASE_URL: process.env.DATABASE_URL!,
    PORT: Number(process.env.PORT ?? 3000),
    JWT_SECRET: process.env.JWT_SECRET!,
    REDIS_URL: process.env.REDIS_URL ?? "redis://localhost:6379",
    CSRF_SECRET: process.env.CSRF_SECRET ?? process.env.JWT_SECRET ?? "csrf-secret",
    NODE_ENV: process.env.NODE_ENV ?? "development",
};
