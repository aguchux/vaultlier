/**
 * /v1/projects/:publicId/schema
 *
 * GET — current schema metadata (environments, keys, version). Used by
 *       `vaultlier pull` and `vaultlier diff`.
 * PUT — additive schema sync from `vaultlier push`: creates missing
 *       environments and keys, updates changed key types/scopes, bumps the
 *       schema version. Never deletes server-side keys and never carries
 *       secret values. Requires a MEMBER+ key. Conflicts (local version
 *       behind the portal) return 409.
 */

import { prisma } from "@vaultlier/db";
import type { KeyType } from "@vaultlier/db";
import { apiError, apiJson, authenticate } from "../../../../../lib/api";
import { logAudit } from "../../../../../lib/audit";
import {
  buildWireSchema,
  fromWireScopes,
  fromWireType,
} from "../../../../../lib/vault-wire";

const NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
const ENV_PATTERN = /^[a-z0-9][a-z0-9-_]*$/i;
const MAX_ENVIRONMENTS = 20;
const MAX_KEYS = 500;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> },
): Promise<Response> {
  const { projectId: publicId } = await params;
  const auth = await authenticate(req, publicId);
  if (!auth.ok) return auth.response;
  const { requestId, project } = auth.ctx;

  const [environments, keys] = await Promise.all([
    prisma.environment.findMany({
      where: { projectId: project.id },
      orderBy: { createdAt: "asc" },
    }),
    prisma.key.findMany({
      where: { projectId: project.id },
      orderBy: { name: "asc" },
    }),
  ]);

  return apiJson(requestId, buildWireSchema(project, environments, keys));
}

interface PushBody {
  version?: number;
  environments: string[];
  keys: Record<string, { type: string; scopes?: string[] }>;
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> },
): Promise<Response> {
  const { projectId: publicId } = await params;
  const auth = await authenticate(req, publicId, "MEMBER");
  if (!auth.ok) return auth.response;
  const { requestId, project, apiKey, ipAddress } = auth.ctx;

  let body: PushBody;
  try {
    body = (await req.json()) as PushBody;
  } catch {
    return apiError(requestId, 400, "request/invalid_json", "Body must be JSON.");
  }

  const validationError = validatePushBody(body);
  if (validationError) {
    return apiError(requestId, 400, "schema/invalid", validationError);
  }

  if (
    typeof body.version === "number" &&
    body.version < project.schemaVersion
  ) {
    return apiError(
      requestId,
      409,
      "schema/version_conflict",
      `Local schema v${body.version} is behind the portal (v${project.schemaVersion}). Run \`vaultlier pull\` first.`,
    );
  }

  const [existingEnvs, existingKeys] = await Promise.all([
    prisma.environment.findMany({ where: { projectId: project.id } }),
    prisma.key.findMany({ where: { projectId: project.id } }),
  ]);

  const knownEnvs = new Set(existingEnvs.map((env) => env.name));
  const newEnvs = body.environments.filter((name) => !knownEnvs.has(name));
  const allEnvs = new Set([...knownEnvs, ...body.environments]);

  const keysByName = new Map(existingKeys.map((key) => [key.name, key]));
  const toCreate: { name: string; type: KeyType; scopes: string[] }[] = [];
  const toUpdate: { id: string; name: string; type: KeyType; scopes: string[] }[] = [];

  for (const [name, schema] of Object.entries(body.keys)) {
    const type = fromWireType(schema.type);
    if (!type) {
      return apiError(
        requestId,
        400,
        "schema/invalid",
        `Key "${name}" has unknown type "${schema.type}".`,
      );
    }
    const scopes = fromWireScopes(schema.scopes);
    const badScope = scopes.find((scope) => !allEnvs.has(scope));
    if (badScope) {
      return apiError(
        requestId,
        400,
        "schema/invalid",
        `Key "${name}" is scoped to unknown environment "${badScope}".`,
      );
    }

    const existing = keysByName.get(name);
    if (!existing) {
      toCreate.push({ name, type, scopes });
    } else if (
      existing.type !== type ||
      existing.scopes.join(",") !== scopes.join(",")
    ) {
      toUpdate.push({ id: existing.id, name, type, scopes });
    }
  }

  const changed = newEnvs.length > 0 || toCreate.length > 0 || toUpdate.length > 0;

  const updatedProject = await prisma.$transaction(async (tx) => {
    if (newEnvs.length > 0) {
      await tx.environment.createMany({
        data: newEnvs.map((name) => ({ projectId: project.id, name })),
      });
      await logAudit(
        {
          action: "ENVIRONMENT_CREATED",
          organizationId: project.organizationId,
          projectId: project.id,
          apiKeyId: apiKey.id,
          ipAddress,
          metadata: { environments: newEnvs, requestId },
        },
        tx,
      );
    }

    if (toCreate.length > 0) {
      await tx.key.createMany({
        data: toCreate.map((key) => ({ ...key, projectId: project.id })),
      });
      await logAudit(
        {
          action: "KEY_CREATED",
          organizationId: project.organizationId,
          projectId: project.id,
          apiKeyId: apiKey.id,
          ipAddress,
          metadata: { keys: toCreate.map((key) => key.name), requestId },
        },
        tx,
      );
    }

    if (toUpdate.length > 0) {
      for (const key of toUpdate) {
        await tx.key.update({
          where: { id: key.id },
          data: { type: key.type, scopes: key.scopes },
        });
      }
      await logAudit(
        {
          action: "KEY_UPDATED",
          organizationId: project.organizationId,
          projectId: project.id,
          apiKeyId: apiKey.id,
          ipAddress,
          metadata: { keys: toUpdate.map((key) => key.name), requestId },
        },
        tx,
      );
    }

    if (!changed) return project;
    return tx.project.update({
      where: { id: project.id },
      data: { schemaVersion: { increment: 1 } },
    });
  });

  const [environments, keys] = await Promise.all([
    prisma.environment.findMany({
      where: { projectId: project.id },
      orderBy: { createdAt: "asc" },
    }),
    prisma.key.findMany({
      where: { projectId: project.id },
      orderBy: { name: "asc" },
    }),
  ]);

  return apiJson(requestId, buildWireSchema(updatedProject, environments, keys));
}

function validatePushBody(body: PushBody): string | undefined {
  if (!body || typeof body !== "object") return "Body must be an object.";
  if (!Array.isArray(body.environments) || body.environments.length === 0) {
    return "`environments` must be a non-empty array.";
  }
  if (body.environments.length > MAX_ENVIRONMENTS) {
    return `At most ${MAX_ENVIRONMENTS} environments are supported.`;
  }
  for (const name of body.environments) {
    if (typeof name !== "string" || !ENV_PATTERN.test(name)) {
      return `Invalid environment name "${String(name)}".`;
    }
  }
  if (body.keys === null || typeof body.keys !== "object") {
    return "`keys` must be an object.";
  }
  const names = Object.keys(body.keys);
  if (names.length > MAX_KEYS) {
    return `At most ${MAX_KEYS} keys are supported.`;
  }
  for (const name of names) {
    if (!NAME_PATTERN.test(name)) return `Invalid key name "${name}".`;
  }
  return undefined;
}
