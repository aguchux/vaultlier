import type { Plan } from "@vaultlier/db";

/**
 * Human-readable plan label. Every organization is on Premium today, so the
 * UI always shows "Premium" regardless of the stored value; this keeps a
 * single place to evolve plan presentation if tiers diverge later.
 */
export function planLabel(plan: Plan): string {
  void plan;
  return "Premium";
}
