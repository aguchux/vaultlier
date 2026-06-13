"use server";

/**
 * Server actions backing the CLI device-login approval page.
 *
 * Approving a session mints a CliToken for the signed-in user, stores its
 * hash, and stashes the raw token on the session for the CLI's next poll to
 * collect exactly once. Denying flips the session to DENIED. Both require a
 * signed-in user and audit the outcome.
 */

import { revalidatePath } from "next/cache";
import { prisma } from "@repo/db";
import { logAudit } from "../../../lib/audit";
import {
  cliTokenExpiry,
  generateCliToken,
  hashCliToken,
} from "../../../lib/cli-auth";
import { requireUser } from "../../../lib/tenancy";

export interface ApprovalState {
  status: "idle" | "approved" | "denied" | "error";
  message?: string;
}

/** Look up a pending, unexpired session by its user code. */
async function findActiveSession(userCode: string) {
  const session = await prisma.cliLoginSession.findUnique({
    where: { userCode },
  });
  if (!session) return { error: "That code was not found." as const };
  if (session.status !== "PENDING") {
    return { error: "That request has already been handled." as const };
  }
  if (session.expiresAt <= new Date()) {
    await prisma.cliLoginSession.update({
      where: { id: session.id },
      data: { status: "EXPIRED" },
    });
    return { error: "That request has expired. Run `vaultlier login` again." as const };
  }
  return { session };
}

export async function approveCliLogin(
  _prev: ApprovalState | null,
  formData: FormData,
): Promise<ApprovalState> {
  const user = await requireUser();
  const userCode = String(formData.get("userCode") ?? "").trim();
  if (!userCode) return { status: "error", message: "Missing code." };

  const found = await findActiveSession(userCode);
  if ("error" in found) return { status: "error", message: found.error };

  const { rawToken, prefix } = generateCliToken();
  const device = String(formData.get("device") ?? "").trim() || null;

  await prisma.$transaction(async (tx) => {
    const token = await tx.cliToken.create({
      data: {
        userId: user.id,
        prefix,
        hashedToken: hashCliToken(rawToken),
        device,
        expiresAt: cliTokenExpiry(),
      },
    });
    await tx.cliLoginSession.update({
      where: { id: found.session.id },
      data: {
        status: "APPROVED",
        userId: user.id,
        cliTokenId: token.id,
        pendingToken: rawToken,
      },
    });
    await logAudit(
      {
        action: "CLI_LOGIN_APPROVED",
        userId: user.id,
        metadata: { sessionId: found.session.publicId, cliTokenId: token.id },
      },
      tx,
    );
  });

  revalidatePath("/cli/approve");
  return {
    status: "approved",
    message: "Approved. You can return to your terminal.",
  };
}

export async function denyCliLogin(
  _prev: ApprovalState | null,
  formData: FormData,
): Promise<ApprovalState> {
  const user = await requireUser();
  const userCode = String(formData.get("userCode") ?? "").trim();
  if (!userCode) return { status: "error", message: "Missing code." };

  const found = await findActiveSession(userCode);
  if ("error" in found) return { status: "error", message: found.error };

  await prisma.$transaction(async (tx) => {
    await tx.cliLoginSession.update({
      where: { id: found.session.id },
      data: { status: "DENIED", userId: user.id },
    });
    await logAudit(
      {
        action: "CLI_LOGIN_DENIED",
        userId: user.id,
        metadata: { sessionId: found.session.publicId },
      },
      tx,
    );
  });

  revalidatePath("/cli/approve");
  return { status: "denied", message: "Request denied." };
}
