import { PrismaClient } from "@prisma/client";

/**
 * Prisma 싱글톤.
 * Next.js 개발 모드에서 HMR이 매번 새 인스턴스를 만들지 않도록 globalThis에 캐싱합니다.
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
