export interface OrganizationLinks {
  projectCount: number;
  memberCount: number;
  pendingInvitationCount: number;
}

export function organizationDeletionBlockers(
  links: OrganizationLinks,
): string[] {
  const blockers: string[] = [];
  if (links.projectCount > 0) {
    blockers.push(
      `${links.projectCount} project${links.projectCount === 1 ? "" : "s"}`,
    );
  }
  if (links.memberCount > 1) {
    blockers.push(
      `${links.memberCount - 1} other member${links.memberCount === 2 ? "" : "s"}`,
    );
  }
  if (links.pendingInvitationCount > 0) {
    blockers.push(
      `${links.pendingInvitationCount} pending invitation${links.pendingInvitationCount === 1 ? "" : "s"}`,
    );
  }
  return blockers;
}

export interface EnvironmentLinks {
  keyVersionCount: number;
  scopedKeyCount: number;
}

export function environmentDeletionBlockers(links: EnvironmentLinks): string[] {
  const blockers: string[] = [];
  if (links.keyVersionCount > 0) {
    blockers.push(
      `${links.keyVersionCount} encrypted value version${links.keyVersionCount === 1 ? "" : "s"}`,
    );
  }
  if (links.scopedKeyCount > 0) {
    blockers.push(
      `${links.scopedKeyCount} scoped key${links.scopedKeyCount === 1 ? "" : "s"}`,
    );
  }
  return blockers;
}

export function normalizeEnvironmentName(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidEnvironmentName(value: string): boolean {
  return /^[a-z][a-z0-9_-]{0,31}$/.test(value);
}

export function replaceEnvironmentScope(
  scopes: string[],
  previousName: string,
  nextName: string,
): string[] {
  return Array.from(
    new Set(scopes.map((scope) => (scope === previousName ? nextName : scope))),
  );
}
