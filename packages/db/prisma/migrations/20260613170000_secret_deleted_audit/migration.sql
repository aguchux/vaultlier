-- AlterEnum
-- New value can't be referenced in the same transaction that adds it
-- (Prisma enforces this for portability across Postgres versions).
ALTER TYPE "AuditAction" ADD VALUE 'SECRET_DELETED';
