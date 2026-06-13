/**
 * /v1/projects
 *
 * GET  — list projects the account can access (across its organizations).
 * POST — create a project in the user's organization. { name }
 *
 * Authenticated by a CLI account token (from `vaultlier login`), NOT a project
 * API key. Used by `vaultlier init` to pick or create a project.
 */

import { randomBytes } from "node:crypto";
import { prisma } from "@repo/db";
import { apiError, apiJson, clientIp, newRequestId } from "../../../lib/api";
import { logAudit } from "../../../lib/audit";
import { authenticateCliToken } from "../../../lib/cli-auth";

const DEFAULT_ENVIRONMENTS = ["dev", "staging", "prod"];
const MAX_PROJECT_NAME = 100;

export async function GET(req: Request): Promise<Response> {
  const requestId = newRequestId();
  const auth = await authenticateCliToken(req);
  if (!auth) {
    return apiError(
      requestId,
      401,
      "auth/invalid_token",
      "Missing or invalid account token. Run `vaultlier login`.",
    );
  }

  const projects = await prisma.project.findMany({
    where: { organization: { memberships: { some: { userId: auth.user.id } } } },
    orderBy: { createdAt: "asc" },
    select: {
      publicId: true,
      name: true,
      organization: { select: { name: true } },
    },
  });

  return apiJson(requestId, {
    projects: projects.map((project) => ({
      publicId: project.publicId,
      name: project.name,
      organization: project.organization.name,
    })),
  });
}

interface CreateBody {
  name?: unknown;
  /** Optional explicit organization; defaults to the user's first org. */
  organizationId?: unknown;
}

export async function POST(req: Request): Promise<Response> {
  const requestId = newRequestId();
  const auth = await authenticateCliToken(req);
  if (!auth) {
    return apiError(
      requestId,
      401,
      "auth/invalid_token",
      "Missing or invalid account token. Run `vaultlier login`.",
    );
  }

  let body: CreateBody;
  try {
    body = (await req.json()) as CreateBody;
  } catch {
    return apiError(requestId, 400, "request/invalid_json", "Body must be JSON.");
  }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return apiError(
      requestId,
      400,
      "request/invalid_body",
      "A project `name` is required.",
    );
  }
  if (name.length > MAX_PROJECT_NAME) {
    return apiError(
      requestId,
      400,
      "request/invalid_body",
      `Project name must be at most ${MAX_PROJECT_NAME} characters.`,
    );
  }

  // Resolve the target org: explicit if provided and the user can write to it,
  // otherwise the user's earliest org where they are not a viewer.
  const memberships = await prisma.membership.findMany({
    where: {
      userId: auth.user.id,
      ...(typeof body.organizationId === "string"
        ? { organizationId: body.organizationId }
        : {}),
    },
    orderBy: { createdAt: "asc" },
  });
  const writable = memberships.find((m) => m.role !== "VIEWER");
  if (!writable) {
    return apiError(
      requestId,
      403,
      "auth/insufficient_role",
      "You don't have permission to create a project in this organization.",
    );
  }

  const ipAddress = clientIp(req);
  const project = await prisma.$transaction(async (tx) => {
    const created = await tx.project.create({
      data: {
        organizationId: writable.organizationId,
        name,
        publicId: `prj_${randomBytes(8).toString("hex")}`,
        environments: {
          create: DEFAULT_ENVIRONMENTS.map((env) => ({ name: env })),
        },
      },
      include: { organization: { select: { name: true } } },
    });
    await logAudit(
      {
        action: "PROJECT_CREATED",
        userId: auth.user.id,
        organizationId: writable.organizationId,
        projectId: created.id,
        ipAddress,
        metadata: { name, publicId: created.publicId, source: "cli" },
      },
      tx,
    );
    return created;
  });

  return apiJson(
    requestId,
    {
      publicId: project.publicId,
      name: project.name,
      organization: project.organization.name,
    },
    { status: 201 },
  );
}
