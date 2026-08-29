import { PrismaClient } from "@prisma/client";
import { logger } from "../lib/logger.js";

const globalForPrisma = globalThis;

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export async function connectDatabase() {
  await prisma.$connect();
  logger.info("db", "connected");
}

export async function disconnectDatabase() {
  await prisma.$disconnect();
  logger.info("db", "disconnected");
}
