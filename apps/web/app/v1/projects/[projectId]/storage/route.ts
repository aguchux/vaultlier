/**
 * /v1/projects/:publicId/storage
 *
 * GET — current storage backend for a project: adapter type, non-sensitive
 *       display metadata (bucket/region/host), and last connection-test status.
 *       Never returns credentials. Any valid key may read.
 * PUT — set the backend. Body: { adapterType, config } where `config` is the
 *       adapter-specific credentials (S3: bucket/region/accessKeyId/
 *       secretAccessKey/endpoint?/prefix?; POSTGRES: connectionString). Runs the
 *       adapter health check, then seals the config with the project KEK and
 *       upserts it. Switching to VAULTLIER clears any external config. Requires
 *       an ADMIN+ key. Credentials are never logged or echoed back.
 *
 * Mirrors the portal's storage settings server action so the CLI (`vaultlier
 * dev`) and any API client manage storage the same way the dashboard does.
 */

import { prisma } from "@vaultlier/db";
import type { StorageAdapterType } from "@vaultlier/db";
import { apiError, apiJson, authenticate } from "../../../../../lib/api";
import { logAudit } from "../../../../../lib/audit";
import { buildAdapter } from "../../../../../lib/storage";
import type {
  AdapterConfig,
  AdapterDisplayMetadata,
  PostgresAdapterConfig,
  S3AdapterConfig,
} from "../../../../../lib/storage/types";
import { encryptSecret } from "../../../../../lib/vault-crypto";

const ADAPTER_TYPES = new Set<StorageAdapterType>([
  "VAULTLIER",
  "S3",
  "POSTGRES",
]);

export async function GET(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> },
): Promise<Response> {
  const { projectId: publicId } = await params;
  const auth = await authenticate(req, publicId);
  if (!auth.ok) return auth.response;
  const { requestId, project } = auth.ctx;

  const config = await prisma.storageAdapterConfig.findUnique({
    where: { projectId: project.id },
    select: {
      adapterType: true,
      metadata: true,
      lastTestStatus: true,
      lastTestedAt: true,
    },
  });

  return apiJson(requestId, {
    adapterType: config?.adapterType ?? "VAULTLIER",
    metadata: config?.metadata ?? null,
    lastTestStatus: config?.lastTestStatus ?? null,
    lastTestedAt: config?.lastTestedAt?.toISOString() ?? null,
  });
}

interface StorageBody {
  adapterType?: string;
  config?: Record<string, unknown>;
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> },
): Promise<Response> {
  const { projectId: publicId } = await params;
  const auth = await authenticate(req, publicId, "ADMIN");
  if (!auth.ok) return auth.response;
  const { requestId, project, apiKey, ipAddress } = auth.ctx;

  let body: StorageBody;
  try {
    body = (await req.json()) as StorageBody;
  } catch {
    return apiError(requestId, 400, "request/invalid_json", "Body must be JSON.");
  }

  const adapterType = body.adapterType as StorageAdapterType;
  if (!ADAPTER_TYPES.has(adapterType)) {
    return apiError(
      requestId,
      400,
      "storage/invalid_adapter",
      "`adapterType` must be VAULTLIER, S3, or POSTGRES.",
    );
  }

  // Switching back to the managed store: drop any external config.
  if (adapterType === "VAULTLIER") {
    await prisma.$transaction(async (tx) => {
      await tx.storageAdapterConfig.deleteMany({
        where: { projectId: project.id },
      });
      await logAudit(
        {
          action: "STORAGE_CONFIG_UPDATED",
          organizationId: project.organizationId,
          projectId: project.id,
          apiKeyId: apiKey.id,
          ipAddress,
          metadata: { adapterType, requestId },
        },
        tx,
      );
    });
    return apiJson(requestId, { adapterType, ok: true });
  }

  const parsed = parseConfig(adapterType, body.config ?? {});
  if (!parsed.ok) {
    return apiError(requestId, 400, "storage/invalid_config", parsed.error);
  }

  const adapter = buildAdapter(project, adapterType, parsed.config);
  if (!adapter) {
    return apiError(
      requestId,
      400,
      "storage/invalid_adapter",
      "Unsupported storage backend.",
    );
  }
  const test = await adapter.test();
  if (!test.ok) {
    return apiError(
      requestId,
      400,
      "storage/connection_failed",
      `Connection test failed: ${test.error ?? "unreachable"}.`,
    );
  }

  const sealed = encryptSecret(project.id, JSON.stringify(parsed.config));
  await prisma.$transaction(async (tx) => {
    await tx.storageAdapterConfig.upsert({
      where: { projectId: project.id },
      update: {
        adapterType,
        ciphertext: new Uint8Array(sealed.ciphertext),
        nonce: new Uint8Array(sealed.nonce),
        authTag: new Uint8Array(sealed.authTag),
        kekId: sealed.kekId,
        metadata: parsed.metadata,
        lastTestedAt: new Date(),
        lastTestStatus: "SUCCESS",
        lastTestError: null,
      },
      create: {
        projectId: project.id,
        adapterType,
        ciphertext: new Uint8Array(sealed.ciphertext),
        nonce: new Uint8Array(sealed.nonce),
        authTag: new Uint8Array(sealed.authTag),
        kekId: sealed.kekId,
        metadata: parsed.metadata,
        lastTestedAt: new Date(),
        lastTestStatus: "SUCCESS",
      },
    });
    await logAudit(
      {
        action: "STORAGE_CONFIG_UPDATED",
        organizationId: project.organizationId,
        projectId: project.id,
        apiKeyId: apiKey.id,
        ipAddress,
        metadata: { ...parsed.metadata, tested: "SUCCESS", requestId },
      },
      tx,
    );
  });

  return apiJson(requestId, {
    adapterType,
    metadata: parsed.metadata,
    tested: "SUCCESS",
    ok: true,
  });
}

/** Validate adapter-specific JSON config; returns the typed config + metadata. */
function parseConfig(
  adapterType: StorageAdapterType,
  raw: Record<string, unknown>,
):
  | { ok: true; config: AdapterConfig; metadata: AdapterDisplayMetadata }
  | { ok: false; error: string } {
  const str = (key: string): string => String(raw[key] ?? "").trim();
  if (adapterType === "S3") {
    const bucket = str("bucket");
    const region = str("region");
    const accessKeyId = str("accessKeyId");
    const secretAccessKey = String(raw.secretAccessKey ?? "");
    const endpoint = str("endpoint");
    const prefix = str("prefix");
    if (!bucket || !region || !accessKeyId || !secretAccessKey) {
      return {
        ok: false,
        error: "S3 requires bucket, region, accessKeyId, and secretAccessKey.",
      };
    }
    const config: S3AdapterConfig = {
      bucket,
      region,
      accessKeyId,
      secretAccessKey,
      ...(endpoint ? { endpoint } : {}),
      ...(prefix ? { prefix } : {}),
    };
    return {
      ok: true,
      config,
      metadata: { adapterType, bucket, region, ...(endpoint ? { endpoint } : {}) },
    };
  }
  if (adapterType === "POSTGRES") {
    const connectionString = str("connectionString");
    if (!connectionString) {
      return { ok: false, error: "Postgres requires a connectionString." };
    }
    const config: PostgresAdapterConfig = { connectionString };
    return {
      ok: true,
      config,
      metadata: { adapterType, host: safeHost(connectionString) },
    };
  }
  return { ok: false, error: "Unsupported storage backend." };
}

/** Host only, for display/audit — never the credentials. */
function safeHost(connectionString: string): string | undefined {
  try {
    return new URL(connectionString).host || undefined;
  } catch {
    return undefined;
  }
}
