import "dotenv/config";

export const env = {
    DATABASE_URL: process.env.DATABASE_URL!,
    PORT: Number(process.env.PORT!),
    JWT_SECRET: process.env.JWT_SECRET!,
};