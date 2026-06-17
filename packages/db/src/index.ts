/**
 * @vaultlier/db — shared Prisma client for the Vaultlier backend.
 *
 * Exposes a single `prisma` instance. A global singleton is reused across
 * hot reloads (Next.js dev) and warm serverless invocations to avoid
 * exhausting database connections.
 *
 * Prisma 7 connects via a driver adapter (pg) configured with DATABASE_URL.
 * Generated client lives in ./generated/client (run `npm run db:generate`).
 */

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/client/client";

export * from "../generated/client/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Configure it in your environment (see packages/db/.env.example).",
    );
  }
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

function getClient(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createClient();
  }
  return globalForPrisma.prisma;
}

// Lazy proxy: the client (and DATABASE_URL) is only needed on first query,
// not at import time. Next.js evaluates route modules during `next build`,
// where no database env is available.
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getClient();
    const value = Reflect.get(client, prop, client);
    return typeof value === "function"
      ? (value as (...args: unknown[]) => unknown).bind(client)
      : value;
  },
});
