/**
 * Audit helper. Every mutational operation in the portal must record an
 * AuditLog row. Mutations done inside a transaction should pass `tx` so the
 * audit entry commits atomically with the change it describes.
 */

import { prisma } from "@repo/db";
import type { AuditAction, Prisma, PrismaClient } from "@repo/db";

type Db = PrismaClient | Prisma.TransactionClient;

export interface AuditEntry {
  action: AuditAction;
  userId?: string | null;
  organizationId?: string | null;
  projectId?: string | null;
  environment?: string | null;
  ipAddress?: string | null;
  metadata?: Prisma.InputJsonValue;
}

export async function logAudit(entry: AuditEntry, db: Db = prisma): Promise<void> {
  await db.auditLog.create({ data: entry });
}
