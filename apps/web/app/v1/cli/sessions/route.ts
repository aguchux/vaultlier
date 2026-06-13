/**
 * POST /v1/cli/sessions
 *
 * Start a CLI device-code login session. Unauthenticated: anyone can request
 * a session, but it grants nothing until a signed-in user approves it in the
 * browser. Returns the pollable session id, the user-facing code, and the
 * verification URL the CLI prints.
 */

import { prisma } from "@repo/db";
import { apiError, apiJson, newRequestId } from "../../../../lib/api";
import {
  CLI_POLL_INTERVAL_SECONDS,
  CLI_SESSION_TTL_SECONDS,
  generateSessionPublicId,
  generateUserCode,
} from "../../../../lib/cli-auth";

function verificationUrl(req: Request, userCode: string): string {
  // Prefer the configured public origin; fall back to the request origin so
  // local dev works without extra env.
  const base = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin;
  return `${base.replace(/\/$/, "")}/cli/approve?code=${encodeURIComponent(userCode)}`;
}

export async function POST(req: Request): Promise<Response> {
  const requestId = newRequestId();
  const expiresAt = new Date(Date.now() + CLI_SESSION_TTL_SECONDS * 1000);

  // userCode is unique; retry a couple of times on the rare collision.
  let session;
  for (let attempt = 0; attempt < 3 && !session; attempt += 1) {
    try {
      session = await prisma.cliLoginSession.create({
        data: {
          publicId: generateSessionPublicId(),
          userCode: generateUserCode(),
          expiresAt,
        },
      });
    } catch {
      // unique-constraint collision on userCode/publicId — try again
    }
  }
  if (!session) {
    return apiError(
      requestId,
      503,
      "cli/session_unavailable",
      "Could not start a login session. Please try again.",
    );
  }

  return apiJson(
    requestId,
    {
      sessionId: session.publicId,
      userCode: session.userCode,
      verificationUrl: verificationUrl(req, session.userCode),
      expiresInSeconds: CLI_SESSION_TTL_SECONDS,
      pollIntervalSeconds: CLI_POLL_INTERVAL_SECONDS,
    },
    { status: 201 },
  );
}
