-- AlterEnum
-- New enum value must be added in its own statement before it can be used
-- (Prisma enforces this for cross-version Postgres portability).
ALTER TYPE "Plan" ADD VALUE 'PREMIUM' AFTER 'HOBBY';
