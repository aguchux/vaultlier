import type { Role } from "@repo/db";

export function canManageProject(role: Role): boolean {
  return role === "OWNER" || role === "ADMIN";
}

/**
 * Who may read/write secret VALUES from the portal. Mirrors the v1 API, where
 * writing secrets requires a MEMBER+ key; viewers are read-only.
 */
export function canWriteSecrets(role: Role): boolean {
  return role === "OWNER" || role === "ADMIN" || role === "MEMBER";
}

export function canManageOrganization(role: Role): boolean {
  return role === "OWNER" || role === "ADMIN";
}

export function canManageRole(
  actorRole: Role,
  targetRole: Role,
  nextRole?: Role,
): boolean {
  if (targetRole === "OWNER" || nextRole === "OWNER") return false;
  if (actorRole === "OWNER") return true;
  if (actorRole !== "ADMIN") return false;
  return targetRole !== "ADMIN" && nextRole !== "ADMIN";
}

export function canInviteRole(actorRole: Role, invitedRole: Role): boolean {
  if (invitedRole === "OWNER") return false;
  if (actorRole === "OWNER") return true;
  return actorRole === "ADMIN" && invitedRole !== "ADMIN";
}
