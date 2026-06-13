-- CreateEnum
CREATE TYPE "CliLoginStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED', 'EXPIRED');

-- AlterEnum
-- Each ADD VALUE must be its own statement; the new values cannot be
-- referenced in the same transaction that adds them (Postgres < 12 rule
-- Prisma enforces for portability).
ALTER TYPE "AuditAction" ADD VALUE 'CLI_LOGIN_APPROVED';
ALTER TYPE "AuditAction" ADD VALUE 'CLI_LOGIN_DENIED';
ALTER TYPE "AuditAction" ADD VALUE 'CLI_TOKEN_REVOKED';

-- CreateTable
CREATE TABLE "cli_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "hashedToken" TEXT NOT NULL,
    "device" TEXT,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cli_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cli_login_sessions" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "userCode" TEXT NOT NULL,
    "status" "CliLoginStatus" NOT NULL DEFAULT 'PENDING',
    "userId" TEXT,
    "cliTokenId" TEXT,
    "pendingToken" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cli_login_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cli_tokens_hashedToken_key" ON "cli_tokens"("hashedToken");

-- CreateIndex
CREATE INDEX "cli_tokens_userId_idx" ON "cli_tokens"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "cli_login_sessions_publicId_key" ON "cli_login_sessions"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "cli_login_sessions_userCode_key" ON "cli_login_sessions"("userCode");

-- CreateIndex
CREATE UNIQUE INDEX "cli_login_sessions_cliTokenId_key" ON "cli_login_sessions"("cliTokenId");

-- CreateIndex
CREATE INDEX "cli_login_sessions_expiresAt_idx" ON "cli_login_sessions"("expiresAt");

-- AddForeignKey
ALTER TABLE "cli_tokens" ADD CONSTRAINT "cli_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cli_login_sessions" ADD CONSTRAINT "cli_login_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cli_login_sessions" ADD CONSTRAINT "cli_login_sessions_cliTokenId_fkey" FOREIGN KEY ("cliTokenId") REFERENCES "cli_tokens"("id") ON DELETE SET NULL ON UPDATE CASCADE;
