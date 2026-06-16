/**
 * /v1/projects/:publicId/environments
 *
 * Manage a project's environments from an API client (the `vaultlier dev` UI).
 * Mirrors the portal's environment server actions, including scope rewrites on
 * rename and deletion-blocker checks.
 *
 *   POST   { name }            create an environment (MEMBER+)
 *   PATCH  { name, to }        rename `name` -> `to`, rewriting key scopes (ADMIN+)
 *   DELETE { name }            delete an empty environment (ADMIN+)
 *
 * Each mutation bumps the project schema version and is audit logged. No secret
 * values are read or returned.
 */

import { prisma } from "@repo/db";
import { apiError, apiJson, authenticate } from "../../../../../lib/api";
import { logAudit } from "../../../../../lib/audit";
import {
  environmentDeletionBlockers,
  isValidEnvironmentName,
  normalizeEnvironmentName,
  replaceEnvironmentScope,
} from "../../../../../lib/resource-policy";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> },
): Promise<Response> {
  const { projectId: publicId } = await params;
  const auth = await authenticate(req, publicId, "MEMBER");
  if (!auth.ok) return auth.response;
  const { requestId, project, apiKey, ipAddress } = auth.ctx;

  const parsed = await readName(req, "name");
  if (!parsed.ok) return apiError(requestId, 400, parsed.code, parsed.message);
  const name = parsed.name;

  const exists = await prisma.environment.findUnique({
    where: { projectId_name: { projectId: project.id, name } },
  });
  if (exists) {
    return apiError(
      requestId,
      409,
      "environment/exists",
      `The "${name}" environment already exists.`,
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.environment.create({ data: { projectId: project.id, name } });
    await tx.project.update({
      where: { id: project.id },
      data: { schemaVersion: { increment: 1 } },
    });
    await logAudit(
      {
        action: "ENVIRONMENT_CREATED",
        organizationId: project.organizationId,
        projectId: project.id,
        apiKeyId: apiKey.id,
        environment: name,
        ipAddress,
        metadata: { name, requestId },
      },
      tx,
    );
  });

  return apiJson(requestId, { name, ok: true });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> },
): Promise<Response> {
  const { projectId: publicId } = await params;
  const auth = await authenticate(req, publicId, "ADMIN");
  if (!auth.ok) return auth.response;
  const { requestId, project, apiKey, ipAddress } = auth.ctx;

  let body: { name?: unknown; to?: unknown };
  try {
    body = (await req.json()) as { name?: unknown; to?: unknown };
  } catch {
    return apiError(requestId, 400, "request/invalid_json", "Body must be JSON.");
  }
  const from = normalizeEnvironmentName(String(body.name ?? ""));
  const to = normalizeEnvironmentName(String(body.to ?? ""));
  if (!isValidEnvironmentName(to)) {
    return apiError(
      requestId,
      400,
      "environment/invalid_name",
      "`to` must be a valid environment name.",
    );
  }

  const environment = await prisma.environment.findUnique({
    where: { projectId_name: { projectId: project.id, name: from } },
  });
  if (!environment) {
    return apiError(
      requestId,
      404,
      "environment/unknown",
      `Unknown environment "${from}".`,
    );
  }
  if (from === to) return apiJson(requestId, { name: to, ok: true });

  const clash = await prisma.environment.findUnique({
    where: { projectId_name: { projectId: project.id, name: to } },
  });
  if (clash) {
    return apiError(
      requestId,
      409,
      "environment/exists",
      `The "${to}" environment already exists.`,
    );
  }

  await prisma.$transaction(async (tx) => {
    const scopedKeys = await tx.key.findMany({
      where: { projectId: project.id, scopes: { has: from } },
      select: { id: true, scopes: true },
    });
    await Promise.all(
      scopedKeys.map((key) =>
        tx.key.update({
          where: { id: key.id },
          data: { scopes: replaceEnvironmentScope(key.scopes, from, to) },
        }),
      ),
    );
    await tx.environment.update({
      where: { id: environment.id },
      data: { name: to },
    });
    await tx.project.update({
      where: { id: project.id },
      data: { schemaVersion: { increment: 1 } },
    });
    await logAudit(
      {
        action: "ENVIRONMENT_UPDATED",
        organizationId: project.organizationId,
        projectId: project.id,
        apiKeyId: apiKey.id,
        environment: to,
        ipAddress,
        metadata: {
          from,
          to,
          updatedScopeCount: scopedKeys.length,
          requestId,
        },
      },
      tx,
    );
  });

  return apiJson(requestId, { name: to, ok: true });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> },
): Promise<Response> {
  const { projectId: publicId } = await params;
  const auth = await authenticate(req, publicId, "ADMIN");
  if (!auth.ok) return auth.response;
  const { requestId, project, apiKey, ipAddress } = auth.ctx;

  const parsed = await readName(req, "name");
  if (!parsed.ok) return apiError(requestId, 400, parsed.code, parsed.message);
  const name = parsed.name;

  const environment = await prisma.environment.findUnique({
    where: { projectId_name: { projectId: project.id, name } },
  });
  if (!environment) {
    return apiError(
      requestId,
      404,
      "environment/unknown",
      `Unknown environment "${name}".`,
    );
  }

  const [keyVersionCount, scopedKeyCount] = await Promise.all([
    prisma.keyVersion.count({ where: { environmentId: environment.id } }),
    prisma.key.count({
      where: { projectId: project.id, scopes: { has: name } },
    }),
  ]);
  const blockers = environmentDeletionBlockers({ keyVersionCount, scopedKeyCount });
  if (blockers.length > 0) {
    return apiError(
      requestId,
      409,
      "environment/not_empty",
      `This environment cannot be deleted while it has ${blockers.join(", ")}.`,
    );
  }

  await prisma.$transaction(async (tx) => {
    await logAudit(
      {
        action: "ENVIRONMENT_DELETED",
        organizationId: project.organizationId,
        projectId: project.id,
        apiKeyId: apiKey.id,
        environment: name,
        ipAddress,
        metadata: { name, requestId },
      },
      tx,
    );
    await tx.environment.delete({ where: { id: environment.id } });
    await tx.project.update({
      where: { id: project.id },
      data: { schemaVersion: { increment: 1 } },
    });
  });

  return apiJson(requestId, { name, deleted: true, ok: true });
}

/** Read + validate an environment name from the JSON body. */
async function readName(
  req: Request,
  field: string,
): Promise<
  | { ok: true; name: string }
  | { ok: false; code: string; message: string }
> {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return { ok: false, code: "request/invalid_json", message: "Body must be JSON." };
  }
  const name = normalizeEnvironmentName(String(body[field] ?? ""));
  if (!isValidEnvironmentName(name)) {
    return {
      ok: false,
      code: "environment/invalid_name",
      message:
        "Environment names must start with a letter and use only lowercase letters, numbers, hyphens, or underscores (max 32 chars).",
    };
  }
  return { ok: true, name };
}
