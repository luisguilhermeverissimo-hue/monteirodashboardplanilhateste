import { PrismaClient } from "@prisma/client";

// Singleton do Prisma Client. Em dev com tsx watch, reaproveita a instância
// via globalThis para não esgotar conexões a cada hot-reload.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
