"use server";

/**
 * Account-level server actions: managing the CLI device tokens minted by
 * `vaultlier login`. Tokens are per-user, so these guard on ownership rather
 * than organization membership.
 */

import { revalidatePath } from "next/cache";
import { prisma } from "@repo/db";
import { logAudit } from "../../../lib/audit";
import { requireUser } from "../../../lib/tenancy";

export async function revokeCliToken(formData: FormData): Promise<void> {
  const user = await requireUser();
  const tokenId = String(formData.get("tokenId") ?? "");
  if (!tokenId) throw new Error("Missing token id.");

  // Scope the update to this user so one account can't revoke another's token.
  const token = await prisma.cliToken.findFirst({
    where: { id: tokenId, userId: user.id, revokedAt: null },
  });
  if (!token) throw new Error("Device session not found.");

  await prisma.$transaction(async (tx) => {
    await tx.cliToken.update({
      where: { id: token.id },
      data: { revokedAt: new Date() },
    });
    await logAudit(
      {
        action: "CLI_TOKEN_REVOKED",
        userId: user.id,
        metadata: { cliTokenId: token.id, device: token.device },
      },
      tx,
    );
  });

  revalidatePath("/dashboard/account");
}
