import type { ReactNode } from "react";
import { SCHEMA_ID, SCHEMA_VERSION } from "./v2/schema";

const codeStyle = {
  background: "light-dark(#f4f4f5, #18211c)",
  borderRadius: "6px",
  padding: "0.15rem 0.4rem",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: "0.9em",
} as const;

const preStyle = {
  background: "#0f172a",
  color: "#e2e8f0",
  borderRadius: "8px",
  padding: "1rem",
  overflowX: "auto" as const,
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: "0.85rem",
};

export default function Home(): ReactNode {
  return (
    <main>
      <h1>Vaultlier Schema</h1>
      <p>
        JSON Schema for the Vaultlier config file (<code style={codeStyle}>
          vaultlier.json
        </code>{" "}
        or <code style={codeStyle}>vaultlier.config.json</code>). The config
        holds project metadata only — never decrypted secret values.
      </p>

      <h2>Current schema ({SCHEMA_VERSION})</h2>
      <p>
        <a href="/v2/vaultlier.schema.json">{SCHEMA_ID}</a>
      </p>

      <h2>Usage</h2>
      <p>
        Reference it from the top of your config so editors validate and
        autocomplete:
      </p>
      <pre style={preStyle}>
        {JSON.stringify(
          {
            $schema: SCHEMA_ID,
            projectId: "prj_checkout_api",
            version: 1,
            environments: ["dev", "staging", "prod"],
            keys: {
              DATABASE_URL: { type: "string", scopes: ["all"] },
              FEATURE_NEW_FLOW: { type: "boolean", default: false },
            },
          },
          null,
          2,
        )}
      </pre>

      <h2>Versioning</h2>
      <p>
        The path is pinned by major version. <code style={codeStyle}>/v2/*</code>{" "}
        is stable; a future breaking change would publish under{" "}
        <code style={codeStyle}>/v3/*</code>. Use{" "}
        <code style={codeStyle}>/v2/latest/vaultlier.schema.json</code> to track
        the newest schema within v2.
      </p>
    </main>
  );
}
