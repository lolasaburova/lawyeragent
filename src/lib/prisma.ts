import { PrismaClient } from "@prisma/client";

// Singleton Prisma client. In dev, Next.js hot-reload would otherwise create a
// new client on every reload and exhaust DB connections, so we cache it on the
// global object.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
