/**
 * Development seed. Creates a demo organization, user, project, environments,
 * and a couple of key definitions. Idempotent via upserts.
 *
 * Run: npm run db:seed --workspace=@repo/db
 */

import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/client/client.js";

// Load packages/db/.env (parent of this prisma/ dir), anchored to this file so
// it works regardless of cwd. In CI, DATABASE_URL is already in the env.
const here = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(here, "..", ".env") });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set (see packages/db/.env.example).");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main(): Promise<void> {
  const org = await prisma.organization.upsert({
    where: { slug: "demo" },
    update: {},
    create: { name: "Demo Org", slug: "demo", plan: "HOBBY" },
  });

  const user = await prisma.user.upsert({
    where: { email: "dev@vaultlier.com" },
    update: {},
    create: { email: "dev@vaultlier.com", name: "Dev User" },
  });

  await prisma.membership.upsert({
    where: {
      userId_organizationId: { userId: user.id, organizationId: org.id },
    },
    update: {},
    create: { userId: user.id, organizationId: org.id, role: "OWNER" },
  });

  const project = await prisma.project.upsert({
    where: { publicId: "prj_demo_checkout" },
    update: {},
    create: {
      publicId: "prj_demo_checkout",
      organizationId: org.id,
      name: "Checkout API",
    },
  });

  for (const name of ["dev", "staging", "prod"]) {
    await prisma.environment.upsert({
      where: { projectId_name: { projectId: project.id, name } },
      update: {},
      create: { projectId: project.id, name },
    });
  }

  await prisma.key.upsert({
    where: { projectId_name: { projectId: project.id, name: "DATABASE_URL" } },
    update: {},
    create: {
      projectId: project.id,
      name: "DATABASE_URL",
      type: "STRING",
      scopes: [],
    },
  });

  await prisma.key.upsert({
    where: {
      projectId_name: { projectId: project.id, name: "FEATURE_NEW_FLOW" },
    },
    update: {},
    create: {
      projectId: project.id,
      name: "FEATURE_NEW_FLOW",
      type: "BOOLEAN",
      scopes: ["prod"],
    },
  });

  console.log("Seeded org=%s project=%s", org.slug, project.publicId);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
