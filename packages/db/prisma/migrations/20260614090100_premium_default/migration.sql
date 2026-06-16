-- AlterTable: new organizations default to PREMIUM.
ALTER TABLE "organizations" ALTER COLUMN "plan" SET DEFAULT 'PREMIUM';

-- Everyone gets Premium: upgrade any existing non-premium organizations.
UPDATE "organizations" SET "plan" = 'PREMIUM' WHERE "plan" = 'HOBBY';
