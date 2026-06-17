/**
 * GET /v1/cli/sessions/:sessionId
 *
 * Poll a CLI device-code login session. Unauthenticated (the sessionId is the
 * bearer of its own authority). Returns:
 *   { status: "pending" }                       — not yet approved
 *   { status: "approved", token, email }        — once, on first poll after approval
 *   { status: "denied" }                         — user rejected it
 *   { status: "expired" }                        — TTL elapsed
 *
 * The raw account token is returned exactly once: it is cleared from the
 * session the moment it is handed back.
 */

import { prisma } from "@vaultlier/db";
import { apiError, apiJson, newRequestId } from "../../../../../lib/api";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ sessionId: string }> },
): Promise<Response> {
  const requestId = newRequestId();
  const { sessionId } = await params;

  const session = await prisma.cliLoginSession.findUnique({
    where: { publicId: sessionId },
    include: { user: { select: { email: true } } },
  });
  if (!session) {
    return apiError(
      requestId,
      404,
      "cli/session_unknown",
      "Unknown login session.",
    );
  }

  // Expire lazily on read so a stale PENDING session reports correctly even
  // without a background sweep.
  if (session.status === "PENDING" && session.expiresAt <= new Date()) {
    await prisma.cliLoginSession.update({
      where: { id: session.id },
      data: { status: "EXPIRED" },
    });
    return apiJson(requestId, { status: "expired" });
  }

  if (session.status === "DENIED") {
    return apiJson(requestId, { status: "denied" });
  }
  if (session.status === "EXPIRED") {
    return apiJson(requestId, { status: "expired" });
  }

  if (session.status === "APPROVED") {
    if (session.pendingToken) {
      // Hand the raw token back exactly once, then clear it.
      const token = session.pendingToken;
      await prisma.cliLoginSession.update({
        where: { id: session.id },
        data: { pendingToken: null },
      });
      return apiJson(requestId, {
        status: "approved",
        token,
        email: session.user?.email ?? undefined,
      });
    }
    // Already consumed once. The CLI keeps the token it received earlier;
    // a duplicate poll just sees pending-like "approved with no token".
    return apiJson(requestId, {
      status: "approved",
      email: session.user?.email ?? undefined,
    });
  }

  return apiJson(requestId, { status: "pending" });
}
