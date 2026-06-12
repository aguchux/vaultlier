-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'MEMBER_JOINED';
ALTER TYPE "AuditAction" ADD VALUE 'MEMBER_ROLE_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'INVITATION_REVOKED';
ALTER TYPE "AuditAction" ADD VALUE 'ORGANIZATION_UPDATED';

-- CreateTable
CREATE TABLE "organization_invitations" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'MEMBER',
    "invitedById" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organization_invitations_organizationId_email_key"
ON "organization_invitations"("organizationId", "email");

-- CreateIndex
CREATE INDEX "organization_invitations_email_acceptedAt_idx"
ON "organization_invitations"("email", "acceptedAt");

-- AddForeignKey
ALTER TABLE "organization_invitations"
ADD CONSTRAINT "organization_invitations_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_invitations"
ADD CONSTRAINT "organization_invitations_invitedById_fkey"
FOREIGN KEY ("invitedById") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
