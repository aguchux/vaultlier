/**
 * Type generator for `lib/vaultlier.ts`.
 *
 * Produces a deterministic, edit-free TypeScript client from a validated
 * Vaultlier config metadata. Never emits secret values, API keys, or decrypted
 * data.
 */

import type { VaultKeyType, VaultlierConfig } from "../schema/types.js";

const HEADER = "// auto-generated — do not edit";

const TYPE_MAP: Record<VaultKeyType, string> = {
  string: "string",
  boolean: "boolean",
  number: "number",
  json: "unknown",
};

/**
 * Generate the contents of `lib/vaultlier.ts` from config metadata.
 * Output is stable: keys are emitted in sorted order so regeneration is
 * deterministic and diff-friendly.
 */
export function generateClient(config: VaultlierConfig): string {
  const keyNames = Object.keys(config.keys).sort();

  const fields = keyNames
    .map((name) => {
      const schema = config.keys[name]!;
      return `  ${formatTypeKey(name)}: ${TYPE_MAP[schema.type]};`;
    })
    .join("\n");

  const schemaBlock = fields.length > 0 ? `\n${fields}\n` : "";

  return `${HEADER}
import { createClient } from 'vaultlier';

export const vault = createClient<{${schemaBlock}}>({ projectId: '${config.projectId}' });
`;
}

function formatTypeKey(name: string): string {
  if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name)) {
    return name;
  }
  return JSON.stringify(name);
}
