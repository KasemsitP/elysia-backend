import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { env } from "./env";

const dbUrl = new URL(env.DATABASE_URL);
dbUrl.searchParams.set("allowPublicKeyRetrieval", "true");

const adapter = new PrismaMariaDb(dbUrl.toString());

export const prisma = new PrismaClient({ adapter });

export type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];