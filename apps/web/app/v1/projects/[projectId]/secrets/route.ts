/**
 * PUT /v1/projects/:publicId/secrets
 *
 * Writes secret values: { environment: "prod", secrets: { KEY: value } }.
 * Each value is validated against the key's declared type, sealed with the
 * project KEK, and stored as a new immutable KeyVersion (history preserved
 * for rotation). Requires a MEMBER+ key. Plaintext is never persisted or
 * echoed back; the response only lists the new version numbers.
 */

import { prisma } from "@repo/db";
import { apiError, apiJson, authenticate } from "../../../../../lib/api";
import { logAudit } from "../../../../../lib/audit";
import { writeSealed } from "../../../../../lib/storage";
import { encryptSecret } from "../../../../../lib/vault-crypto";
import { keyInScope, normalizeValue } from "../../../../../lib/vault-wire";

const MAX_SECRETS_PER_REQUEST = 100;
const MAX_VALUE_LENGTH = 32 * 1024;

interface SecretsBody {
  environment: string;
  secrets: Record<string, unknown>;
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> },
): Promise<Response> {
  const { projectId: publicId } = await params;
  const auth = await authenticate(req, publicId, "MEMBER");
  if (!auth.ok) return auth.response;
  const { requestId, project, apiKey, ipAddress } = auth.ctx;

  let body: SecretsBody;
  try {
    body = (await req.json()) as SecretsBody;
  } catch {
    return apiError(requestId, 400, "request/invalid_json", "Body must be JSON.");
  }
  if (
    !body ||
    typeof body.environment !== "string" ||
    body.secrets === null ||
    typeof body.secrets !== "object" ||
    Array.isArray(body.secrets)
  ) {
    return apiError(
      requestId,
      400,
      "request/invalid_body",
      "Body must be { environment: string, secrets: { KEY: value } }.",
    );
  }
  const entries = Object.entries(body.secrets);
  if (entries.length === 0 || entries.length > MAX_SECRETS_PER_REQUEST) {
    return apiError(
      requestId,
      400,
      "request/invalid_body",
      `Provide between 1 and ${MAX_SECRETS_PER_REQUEST} secrets per request.`,
    );
  }

  const env = await prisma.environment.findUnique({
    where: {
      projectId_name: { projectId: project.id, name: body.environment },
    },
  });
  if (!env) {
    return apiError(
      requestId,
      404,
      "environment/unknown",
      `Unknown environment "${body.environment}".`,
    );
  }

  const keys = await prisma.key.findMany({
    where: { projectId: project.id, name: { in: entries.map(([name]) => name) } },
  });
  const keysByName = new Map(keys.map((key) => [key.name, key]));

  // Validate everything up front so a request either fully applies or not.
  const writes: { keyId: string; name: string; plaintext: string }[] = [];
  for (const [name, value] of entries) {
    const key = keysByName.get(name);
    if (!key) {
      return apiError(
        requestId,
        400,
        "key/unknown",
        `Key "${name}" is not in the project schema. Run \`vaultlier push\` first.`,
      );
    }
    if (!keyInScope(key, body.environment)) {
      return apiError(
        requestId,
        400,
        "key/out_of_scope",
        `Key "${name}" is not scoped to environment "${body.environment}".`,
      );
    }
    const normalized = normalizeValue(value, key.type);
    if (!normalized.ok) {
      return apiError(
        requestId,
        400,
        "value/invalid",
        `Value for "${name}": ${normalized.error}.`,
      );
    }
    if (normalized.plaintext.length > MAX_VALUE_LENGTH) {
      return apiError(
        requestId,
        400,
        "value/too_large",
        `Value for "${name}" exceeds ${MAX_VALUE_LENGTH} bytes.`,
      );
    }
    writes.push({ keyId: key.id, name, plaintext: normalized.plaintext });
  }

  const { versions, drifted } = await prisma.$transaction(async (tx) => {
    const result: Record<string, number> = {};
    const driftedKeys: string[] = [];
    for (const write of writes) {
      const latest = await tx.keyVersion.findFirst({
        where: { keyId: write.keyId, environmentId: env.id },
        orderBy: { version: "desc" },
        select: { version: true },
      });
      const version = (latest?.version ?? 0) + 1;
      const sealed = encryptSecret(project.id, write.plaintext);
      // Copy into fresh ArrayBuffer-backed arrays: Prisma's Bytes type rejects
      // Buffer's ArrayBufferLike backing.
      const blob = {
        ciphertext: new Uint8Array(sealed.ciphertext),
        nonce: new Uint8Array(sealed.nonce),
        authTag: new Uint8Array(sealed.authTag),
        kekId: sealed.kekId,
      };
      const { needsResync } = await writeSealed(
        project,
        { environment: body.environment, keyName: write.name, version },
        blob,
      );
      if (needsResync) driftedKeys.push(write.name);
      const created = await tx.keyVersion.create({
        data: {
          keyId: write.keyId,
          environmentId: env.id,
          version,
          ciphertext: blob.ciphertext,
          nonce: blob.nonce,
          authTag: blob.authTag,
          kekId: blob.kekId,
          needsResync,
        },
      });
      result[write.name] = created.version;
    }
    await logAudit(
      {
        action: "SECRET_WRITTEN",
        organizationId: project.organizationId,
        projectId: project.id,
        apiKeyId: apiKey.id,
        environment: body.environment,
        ipAddress,
        metadata: { keys: writes.map((write) => write.name), requestId },
      },
      tx,
    );
    if (driftedKeys.length > 0) {
      await logAudit(
        {
          action: "STORAGE_SYNC_FAILED",
          organizationId: project.organizationId,
          projectId: project.id,
          apiKeyId: apiKey.id,
          environment: body.environment,
          ipAddress,
          metadata: { keys: driftedKeys, requestId },
        },
        tx,
      );
    }
    return { versions: result, drifted: driftedKeys.length > 0 };
  });

  return apiJson(requestId, {
    environment: body.environment,
    versions,
    // Surfaced so the CLI can warn that the external store is behind; the
    // value is safely stored in Vaultlier's fallback in the meantime.
    ...(drifted ? { warning: "external_storage_unavailable" } : {}),
  });
}
