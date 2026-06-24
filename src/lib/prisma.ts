import { PrismaClient } from "@prisma/client";

// Resolve the database connection string. Vercel Prisma Postgres creates a
// project-prefixed variable (lawyer_DATABASE_URL); locally you may still use
// DATABASE_URL. When defined we pass it explicitly so the runtime client works
// regardless of which name is set; otherwise Prisma falls back to the schema's
// env("lawyer_DATABASE_URL").
const databaseUrl =
  process.env.lawyer_DATABASE_URL || process.env.DATABASE_URL;

// Singleton Prisma client. In dev, Next.js hot-reload would otherwise create a
// new client on every reload and exhaust DB connections, so we cache it on the
// global object.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    ...(databaseUrl ? { datasourceUrl: databaseUrl } : {}),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
