import { vaultlierConfigSchema } from "../../schema";

/**
 * Alias for the current v2 schema at /v2/latest/vaultlier.schema.json.
 * Mirrors /v2/vaultlier.schema.json so tooling can pin to "latest within v2".
 */
export const dynamic = "force-static";

export function GET(): Response {
  return new Response(JSON.stringify(vaultlierConfigSchema, null, 2), {
    headers: {
      "content-type": "application/schema+json; charset=utf-8",
      "cache-control": "public, max-age=3600, s-maxage=86400",
      "access-control-allow-origin": "*",
    },
  });
}
