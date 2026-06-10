import { vaultlierConfigSchema } from "../schema";

/**
 * Serves the canonical Vaultlier config JSON Schema at
 * /v2/vaultlier.schema.json. Statically rendered and long-cached; the schema
 * is immutable for a given major version (`v2`).
 */
export const dynamic = "force-static";

export function GET(): Response {
  return new Response(JSON.stringify(vaultlierConfigSchema, null, 2), {
    headers: {
      "content-type": "application/schema+json; charset=utf-8",
      "cache-control": "public, max-age=3600, s-maxage=86400, immutable",
      "access-control-allow-origin": "*",
    },
  });
}
