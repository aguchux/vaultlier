import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { defineConfig, env } from "prisma/config";

/**
 * Prisma 7 configuration. The datasource URL lives here (resolved via `env`)
 * rather than in schema.prisma, and is also passed to PrismaClient through a
 * driver adapter at runtime.
 *
 * Prisma 7 no longer auto-loads `.env`, so we load this package's `.env`
 * explicitly, anchored to the config file's directory so it works regardless
 * of the cwd the CLI is invoked from.
 */
const here = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(here, ".env") });

function resolveDatasourceUrl(): string {
  if (process.env.DATABASE_URL) {
    return env("DATABASE_URL");
  }

  if (process.argv.includes("generate")) {
    return "postgresql://vaultlier:placeholder@localhost:5432/vaultlier";
  }

  return env("DATABASE_URL");
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: resolveDatasourceUrl(),
  },
});
