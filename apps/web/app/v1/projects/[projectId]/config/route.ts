/**
 * GET /v1/projects/:publicId/config?environment=<name>
 *
 * The runtime SDK endpoint (vaultlier `createClient`). Returns the decrypted,
 * typed key/value map for one environment. Reads are audit logged; plaintext
 * exists only in the response body.
 */

import { prisma } from "@repo/db";
import { apiError, apiJson, authenticate } from "../../../../../lib/api";
import { logAudit } from "../../../../../lib/audit";
import { decryptSecret } from "../../../../../lib/vault-crypto";
import { coerceValue, keyInScope } from "../../../../../lib/vault-wire";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> },
): Promise<Response> {
  const { projectId: publicId } = await params;
  const auth = await authenticate(req, publicId);
  if (!auth.ok) return auth.response;
  const { requestId, project, apiKey, ipAddress } = auth.ctx;

  const environment = new URL(req.url).searchParams.get("environment");
  if (!environment) {
    return apiError(
      requestId,
      400,
      "request/missing_environment",
      "Query parameter `environment` is required.",
    );
  }

  const env = await prisma.environment.findUnique({
    where: { projectId_name: { projectId: project.id, name: environment } },
  });
  if (!env) {
    return apiError(
      requestId,
      404,
      "environment/unknown",
      `Unknown environment "${environment}".`,
    );
  }

  const keys = await prisma.key.findMany({
    where: { projectId: project.id },
    include: {
      versions: {
        where: { environmentId: env.id },
        orderBy: { version: "desc" },
        take: 1,
      },
    },
  });

  const config: Record<string, unknown> = {};
  const readKeys: string[] = [];
  for (const key of keys) {
    if (!keyInScope(key, environment)) continue;
    const version = key.versions[0];
    if (!version) continue;
    const plaintext = decryptSecret(project.id, {
      ciphertext: Buffer.from(version.ciphertext),
      nonce: Buffer.from(version.nonce),
      authTag: Buffer.from(version.authTag),
      kekId: version.kekId,
    });
    config[key.name] = coerceValue(plaintext, key.type);
    readKeys.push(key.name);
  }

  await logAudit({
    action: "SECRET_READ",
    organizationId: project.organizationId,
    projectId: project.id,
    apiKeyId: apiKey.id,
    environment,
    ipAddress,
    metadata: { keys: readKeys, requestId },
  });

  return apiJson(requestId, config);
}
