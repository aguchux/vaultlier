/**
 * Portal API client used by `vaultlier pull`, `push`, and `diff`.
 *
 * Talks to the Vaultlier vault API (`/v1/projects/:id/schema`). The schema
 * endpoints exchange METADATA only — key names, types, scopes, environments.
 * The one exception is `fetchEnvironmentConfig` (`/v1/projects/:id/config`),
 * which `vaultlier dev` uses to display dev-environment values locally;
 * those values are held in memory and never written to disk.
 *
 * Node-only (CLI layer). The base URL resolves from `--api-url`, then
 * `VAULTLIER_API_URL`, then the hosted default.
 */

import type { VaultKeySchema, VaultlierConfig } from "../schema/types.js";

export const DEFAULT_API_URL = "https://vaultlier.com";
export const API_URL_ENV = "VAULTLIER_API_URL";

const REQUEST_TIMEOUT_MS = 15_000;

/** Schema document exchanged with the portal. Metadata only. */
export interface PortalSchema {
  projectId: string;
  version: number;
  environments: string[];
  keys: Record<string, VaultKeySchema>;
}

/** Minimal fetch signature so tests and embedders can inject a transport. */
export type FetchLike = (
  url: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    signal?: AbortSignal;
  },
) => Promise<{
  ok: boolean;
  status: number;
  headers: { get(name: string): string | null };
  json(): Promise<unknown>;
}>;

/**
 * Error from the portal API. Carries a stable `code`, a safe message, and the
 * server request id — never the API key or any secret value.
 */
export class PortalApiError extends Error {
  readonly code: string;
  readonly status?: number;
  readonly requestId?: string;

  constructor(
    code: string,
    message: string,
    options: { status?: number; requestId?: string } = {},
  ) {
    super(message);
    this.name = "PortalApiError";
    this.code = code;
    this.status = options.status;
    this.requestId = options.requestId;
  }
}

export interface PortalClientOptions {
  apiUrl: string;
  /**
   * Bearer credential: a project API key (vlt_...) or an account token from
   * `vaultlier login`. Omit for unauthenticated endpoints (login start/poll).
   */
  apiKey?: string;
  fetchImpl?: FetchLike;
}

export function resolveApiUrl(
  flagValue: string | boolean | undefined,
  env: Record<string, string | undefined>,
): string {
  const fromFlag = typeof flagValue === "string" ? flagValue : undefined;
  const url = fromFlag ?? env[API_URL_ENV] ?? DEFAULT_API_URL;
  return url.replace(/\/$/, "");
}

/** GET the portal's current schema for a project. */
export function fetchPortalSchema(
  options: PortalClientOptions,
  projectId: string,
): Promise<PortalSchema> {
  return request(options, {
    method: "GET",
    path: `/v1/projects/${encodeURIComponent(projectId)}/schema`,
  });
}

/** PUT the local schema to the portal (additive sync). Returns the result. */
export function pushPortalSchema(
  options: PortalClientOptions,
  config: VaultlierConfig,
): Promise<PortalSchema> {
  return request(options, {
    method: "PUT",
    path: `/v1/projects/${encodeURIComponent(config.projectId)}/schema`,
    body: {
      version: config.version,
      environments: config.environments,
      keys: config.keys,
    },
  });
}

/** Result of a secret write: new version number per key. Never values. */
export interface SecretWriteResult {
  environment: string;
  versions: Record<string, number>;
}

/**
 * PUT secret values for one environment (`vaultlier set`). Values travel in
 * the request body over HTTPS; the response carries version numbers only,
 * and nothing here logs or stores the values.
 */
export async function putEnvironmentSecrets(
  options: PortalClientOptions,
  projectId: string,
  environment: string,
  secrets: Record<string, string>,
): Promise<SecretWriteResult> {
  const payload = await requestJson(options, {
    method: "PUT",
    path: `/v1/projects/${encodeURIComponent(projectId)}/secrets`,
    body: { environment, secrets },
  });
  const result = payload as Partial<SecretWriteResult> | null;
  if (
    result === null ||
    typeof result !== "object" ||
    typeof result.environment !== "string" ||
    result.versions === null ||
    typeof result.versions !== "object"
  ) {
    throw new PortalApiError(
      "response/invalid",
      "portal returned an unexpected secrets payload",
    );
  }
  return { environment: result.environment, versions: result.versions };
}

/**
 * GET the decrypted key/value map for one environment (`vaultlier dev` uses
 * this for the local "dev" environment only). Unlike the schema endpoints,
 * this DOES return secret values; callers must keep them on-machine.
 */
export async function fetchEnvironmentConfig(
  options: PortalClientOptions,
  projectId: string,
  environment: string,
): Promise<Record<string, unknown>> {
  const payload = await requestJson(options, {
    method: "GET",
    path:
      `/v1/projects/${encodeURIComponent(projectId)}/config` +
      `?environment=${encodeURIComponent(environment)}`,
  });
  if (
    payload === null ||
    typeof payload !== "object" ||
    Array.isArray(payload)
  ) {
    throw new PortalApiError(
      "response/invalid",
      "portal returned an unexpected config payload",
    );
  }
  return payload as Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Account endpoints (device-code login, project list/create)
//
// Wire protocol the portal implements:
//   POST /v1/cli/sessions            {}              -> CliLoginSession
//   GET  /v1/cli/sessions/:sessionId                 -> CliLoginPoll
//   GET  /v1/projects                (account token) -> { projects: [...] }
//   POST /v1/projects                { name }        -> ProjectSummary
//
// The login flow follows the OAuth device-code pattern: the CLI starts a
// session, shows the user a URL + short code, and polls until the user
// approves it in their browser. The returned account token authorizes
// project listing/creation only — it is not a project API key.
// ---------------------------------------------------------------------------

export interface CliLoginSession {
  sessionId: string;
  /** Short human-verifiable code shown in the CLI and the browser. */
  userCode: string;
  /** Page where the user signs in and approves this CLI session. */
  verificationUrl: string;
  expiresInSeconds: number;
  pollIntervalSeconds: number;
}

export type CliLoginPoll =
  | { status: "pending" }
  | { status: "approved"; token: string; email?: string }
  | { status: "denied" }
  | { status: "expired" };

export interface ProjectSummary {
  publicId: string;
  name: string;
  organization?: string;
}

/** Start a device-code login session. Unauthenticated. */
export async function startCliLogin(
  options: PortalClientOptions,
): Promise<CliLoginSession> {
  const payload = await requestJson(
    { ...options, apiKey: undefined },
    { method: "POST", path: "/v1/cli/sessions", body: {} },
  );
  const session = payload as Partial<CliLoginSession> | null;
  if (
    session === null ||
    typeof session !== "object" ||
    typeof session.sessionId !== "string" ||
    typeof session.userCode !== "string" ||
    typeof session.verificationUrl !== "string"
  ) {
    throw new PortalApiError(
      "response/invalid",
      "portal returned an unexpected login session payload",
    );
  }
  return {
    sessionId: session.sessionId,
    userCode: session.userCode,
    verificationUrl: session.verificationUrl,
    expiresInSeconds:
      typeof session.expiresInSeconds === "number"
        ? session.expiresInSeconds
        : 900,
    pollIntervalSeconds:
      typeof session.pollIntervalSeconds === "number"
        ? session.pollIntervalSeconds
        : 5,
  };
}

/** Poll a device-code login session. Unauthenticated. */
export async function pollCliLogin(
  options: PortalClientOptions,
  sessionId: string,
): Promise<CliLoginPoll> {
  const payload = await requestJson(
    { ...options, apiKey: undefined },
    {
      method: "GET",
      path: `/v1/cli/sessions/${encodeURIComponent(sessionId)}`,
    },
  );
  const poll = payload as Partial<CliLoginPoll> | null;
  if (poll === null || typeof poll !== "object") {
    throw new PortalApiError(
      "response/invalid",
      "portal returned an unexpected login poll payload",
    );
  }
  if (poll.status === "approved") {
    const approved = poll as { token?: unknown; email?: unknown };
    if (typeof approved.token !== "string" || approved.token.length === 0) {
      throw new PortalApiError(
        "response/invalid",
        "portal approved the login but returned no token",
      );
    }
    return {
      status: "approved",
      token: approved.token,
      email: typeof approved.email === "string" ? approved.email : undefined,
    };
  }
  if (
    poll.status === "pending" ||
    poll.status === "denied" ||
    poll.status === "expired"
  ) {
    return { status: poll.status };
  }
  throw new PortalApiError(
    "response/invalid",
    "portal returned an unknown login session status",
  );
}

/** List the projects the authenticated account can access. */
export async function listProjects(
  options: PortalClientOptions,
): Promise<ProjectSummary[]> {
  const payload = await requestJson(options, {
    method: "GET",
    path: "/v1/projects",
  });
  const body = payload as { projects?: unknown } | null;
  if (body === null || typeof body !== "object" || !Array.isArray(body.projects)) {
    throw new PortalApiError(
      "response/invalid",
      "portal returned an unexpected project list payload",
    );
  }
  return body.projects.filter(isProjectSummary);
}

/** Create a new project owned by the authenticated account. */
export async function createProject(
  options: PortalClientOptions,
  name: string,
): Promise<ProjectSummary> {
  const payload = await requestJson(options, {
    method: "POST",
    path: "/v1/projects",
    body: { name },
  });
  if (!isProjectSummary(payload)) {
    throw new PortalApiError(
      "response/invalid",
      "portal returned an unexpected project payload",
    );
  }
  return payload;
}

function isProjectSummary(value: unknown): value is ProjectSummary {
  if (value === null || typeof value !== "object") return false;
  const project = value as Partial<ProjectSummary>;
  return (
    typeof project.publicId === "string" && typeof project.name === "string"
  );
}

async function request(
  options: PortalClientOptions,
  params: { method: string; path: string; body?: unknown },
): Promise<PortalSchema> {
  const payload = await requestJson(options, params);
  const schema = parsePortalSchema(payload);
  if (!schema) {
    throw new PortalApiError(
      "response/invalid",
      "portal returned an unexpected schema payload",
    );
  }
  return schema;
}

async function requestJson(
  options: PortalClientOptions,
  params: { method: string; path: string; body?: unknown },
): Promise<unknown> {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res: Awaited<ReturnType<FetchLike>>;
  try {
    res = await fetchImpl(`${options.apiUrl}${params.path}`, {
      method: params.method,
      headers: {
        ...(options.apiKey !== undefined
          ? { authorization: `Bearer ${options.apiKey}` }
          : {}),
        accept: "application/json",
        ...(params.body !== undefined
          ? { "content-type": "application/json" }
          : {}),
      },
      body: params.body !== undefined ? JSON.stringify(params.body) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new PortalApiError(
        "network/timeout",
        `portal request timed out after ${REQUEST_TIMEOUT_MS}ms`,
      );
    }
    throw new PortalApiError(
      "network/error",
      `could not reach the Vaultlier portal at ${options.apiUrl}`,
    );
  } finally {
    clearTimeout(timer);
  }

  const requestId = res.headers.get("x-request-id") ?? undefined;
  const payload = await res.json().catch(() => undefined);

  if (!res.ok) {
    const body = payload as
      | { code?: string; message?: string }
      | undefined;
    throw new PortalApiError(
      body?.code ?? `http/${res.status}`,
      body?.message ?? `portal request failed with status ${res.status}`,
      { status: res.status, requestId },
    );
  }

  return payload;
}

function parsePortalSchema(payload: unknown): PortalSchema | undefined {
  if (payload === null || typeof payload !== "object") return undefined;
  const doc = payload as Partial<PortalSchema>;
  if (
    typeof doc.projectId !== "string" ||
    typeof doc.version !== "number" ||
    !Array.isArray(doc.environments) ||
    doc.keys === null ||
    typeof doc.keys !== "object"
  ) {
    return undefined;
  }
  return {
    projectId: doc.projectId,
    version: doc.version,
    environments: doc.environments.filter(
      (name): name is string => typeof name === "string",
    ),
    keys: doc.keys,
  };
}

export interface SchemaDiff {
  onlyLocal: string[];
  onlyPortal: string[];
  changed: string[];
  environmentsOnlyLocal: string[];
  environmentsOnlyPortal: string[];
}

export function diffSchemas(
  local: VaultlierConfig,
  portal: PortalSchema,
): SchemaDiff {
  const localKeys = new Set(Object.keys(local.keys));
  const portalKeys = new Set(Object.keys(portal.keys));

  const changed = [...localKeys]
    .filter((name) => portalKeys.has(name))
    .filter((name) => {
      const a = local.keys[name]!;
      const b = portal.keys[name]!;
      return (
        a.type !== b.type ||
        normalizeScopes(a.scopes).join(",") !==
          normalizeScopes(b.scopes).join(",")
      );
    });

  return {
    onlyLocal: [...localKeys].filter((name) => !portalKeys.has(name)).sort(),
    onlyPortal: [...portalKeys].filter((name) => !localKeys.has(name)).sort(),
    changed: changed.sort(),
    environmentsOnlyLocal: local.environments
      .filter((name) => !portal.environments.includes(name))
      .sort(),
    environmentsOnlyPortal: portal.environments
      .filter((name) => !local.environments.includes(name))
      .sort(),
  };
}

export function isDiffEmpty(diff: SchemaDiff): boolean {
  return (
    diff.onlyLocal.length === 0 &&
    diff.onlyPortal.length === 0 &&
    diff.changed.length === 0 &&
    diff.environmentsOnlyLocal.length === 0 &&
    diff.environmentsOnlyPortal.length === 0
  );
}

function normalizeScopes(scopes: string[] | undefined): string[] {
  if (!scopes || scopes.length === 0 || scopes.includes("all")) return ["all"];
  return [...scopes].sort();
}
