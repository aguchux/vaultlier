-- CreateEnum
CREATE TYPE "StorageAdapterType" AS ENUM ('VAULTLIER', 'S3', 'POSTGRES');

-- AlterEnum
-- Each ADD VALUE must be its own statement; the new values cannot be
-- referenced in the same transaction that adds them, so storage_adapter_configs
-- (which defaults to a StorageAdapterType value) is created in a later migration.
ALTER TYPE "AuditAction" ADD VALUE 'STORAGE_CONFIG_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'STORAGE_CONFIG_TESTED';
ALTER TYPE "AuditAction" ADD VALUE 'STORAGE_SYNC_FAILED';
