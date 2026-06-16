-- AlterTable: drift flag on the fallback DB copy of each value.
ALTER TABLE "key_versions" ADD COLUMN "needsResync" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "storage_adapter_configs" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "adapterType" "StorageAdapterType" NOT NULL DEFAULT 'VAULTLIER',
    "ciphertext" BYTEA NOT NULL,
    "nonce" BYTEA NOT NULL,
    "authTag" BYTEA NOT NULL,
    "kekId" TEXT NOT NULL,
    "metadata" JSONB,
    "lastTestedAt" TIMESTAMP(3),
    "lastTestStatus" TEXT,
    "lastTestError" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "storage_adapter_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "storage_adapter_configs_projectId_key" ON "storage_adapter_configs"("projectId");

-- AddForeignKey
ALTER TABLE "storage_adapter_configs" ADD CONSTRAINT "storage_adapter_configs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
