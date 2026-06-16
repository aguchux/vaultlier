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
  apiKeyId?: string | null;
  organizationId?: string | null;
  projectId?: string | null;
  environment?: string | null;
  ipAddress?: string | null;
  metadata?: Prisma.InputJsonValue;
}

export async function logAudit(entry: AuditEntry, db: Db = prisma): Promise<void> {
  await db.auditLog.create({ data: entry });
}

/**
 * Read-only actions that are recorded for traceability but are NOT shown in the
 * activity UI. Reads happen on every runtime resolution, so surfacing them
 * would bury the meaningful mutations and bloat the activity views. They stay
 * in the table for forensic queries.
 */
export const READ_AUDIT_ACTIONS: readonly AuditAction[] = ["SECRET_READ"];

/**
 * Prisma `where` filter that excludes read-only actions. Spread into an
 * AuditLog query to show only mutations in the UI:
 *   where: { projectId, ...activityActionFilter() }
 */
export function activityActionFilter(): { action: { notIn: AuditAction[] } } {
  return { action: { notIn: [...READ_AUDIT_ACTIONS] } };
}
