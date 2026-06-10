/**
 * `vaultlier dev` — local transparency UI.
 *
 * Starts a small HTTP server (Node-only, no third-party deps) that renders the
 * project's Vaultlier config as a read-only dashboard. The intent is trust:
 * users can see exactly what metadata is stored locally, on their own machine,
 * with nothing leaving it.
 *
 * It shows METADATA ONLY — key names, types, scopes, environments, projectId,
 * and a MASKED apiKey. Decrypted secret values are never read or displayed.
 * The server binds to loopback (127.0.0.1) so it is not exposed to the network.
 */

import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { VaultlierConfig } from "../schema/types.js";

export const DEV_PORT = 9090;
export const DEV_HOST = "127.0.0.1";

/** Read-only snapshot the UI renders. Never contains secret values. */
export interface DevSnapshot {
  projectId: string;
  version: number;
  environments: string[];
  keys: Array<{
    name: string;
    type: string;
    scopes: string[];
    default?: string | number | boolean | null;
  }>;
  /** Masked apiKey for display, or null when no credential cache exists. */
  maskedApiKey: string | null;
  configFile: string;
}

/** Build the read-only snapshot from config + masked credentials. */
export function buildSnapshot(params: {
  config: VaultlierConfig;
  configFile: string;
  maskedApiKey: string | null;
}): DevSnapshot {
  const { config } = params;
  return {
    projectId: config.projectId,
    version: config.version,
    environments: config.environments,
    keys: Object.entries(config.keys).map(([name, schema]) => ({
      name,
      type: schema.type,
      scopes: schema.scopes ?? ["all"],
      default: schema.default,
    })),
    maskedApiKey: params.maskedApiKey,
    configFile: params.configFile,
  };
}

export interface DevServerHandle {
  url: string;
  port: number;
  close: () => Promise<void>;
}

/**
 * Start the dev UI server. Resolves once the server is listening. The snapshot
 * is captured at start time; restart the command to pick up config changes.
 */
export function startDevServer(
  snapshot: DevSnapshot,
  options: { port?: number; host?: string } = {},
): Promise<DevServerHandle> {
  const port = options.port ?? DEV_PORT;
  const host = options.host ?? DEV_HOST;
  const html = renderHtml(snapshot);

  const server: Server = createServer((req, res) => {
    // Reject anything but local GETs; this is a read-only viewer.
    if (req.method !== "GET") {
      res.writeHead(405, { "content-type": "text/plain; charset=utf-8" });
      res.end("Method Not Allowed");
      return;
    }

    if (req.url === "/api/snapshot") {
      res.writeHead(200, {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
      });
      res.end(JSON.stringify(snapshot, null, 2));
      return;
    }

    if (req.url === "/" || req.url === "/index.html") {
      res.writeHead(200, {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
      });
      res.end(html);
      return;
    }

    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not Found");
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      const address = server.address() as AddressInfo;
      const boundPort = address.port;
      resolve({
        url: `http://${host}:${boundPort}/`,
        port: boundPort,
        close: () =>
          new Promise<void>((res, rej) =>
            server.close((err) => (err ? rej(err) : res())),
          ),
      });
    });
  });
}

/** Escape a string for safe interpolation into HTML text/attributes. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Render the self-contained dashboard. No external assets, no inline secrets. */
export function renderHtml(snapshot: DevSnapshot): string {
  const rows =
    snapshot.keys.length === 0
      ? `<tr><td colspan="4" class="empty">No keys defined yet. Add keys in the portal, then run <code>vaultlier pull</code>.</td></tr>`
      : snapshot.keys
          .map((key) => {
            const def =
              key.default === undefined
                ? "<span class=\"muted\">—</span>"
                : `<code>${escapeHtml(String(key.default))}</code>`;
            return `<tr>
              <td><code>${escapeHtml(key.name)}</code></td>
              <td><span class="type type-${escapeHtml(key.type)}">${escapeHtml(key.type)}</span></td>
              <td>${key.scopes.map((s) => `<span class="scope">${escapeHtml(s)}</span>`).join(" ")}</td>
              <td>${def}</td>
            </tr>`;
          })
          .join("\n");

  const envChips = snapshot.environments
    .map((env) => `<span class="env">${escapeHtml(env)}</span>`)
    .join(" ");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Vaultlier · ${escapeHtml(snapshot.projectId)}</title>
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body {
    font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
    margin: 0; padding: 2rem 1.25rem; line-height: 1.55;
    max-width: 60rem; margin-inline: auto; color: #18181b; background: #fafafa;
  }
  @media (prefers-color-scheme: dark) {
    body { color: #e4e4e7; background: #0b0b0f; }
    header, .card { background: #16161c !important; border-color: #27272a !important; }
    code, .type, .scope, .env { background: #27272a !important; }
  }
  header {
    display: flex; align-items: center; justify-content: space-between; gap: 1rem;
    padding: 1rem 1.25rem; border: 1px solid #e4e4e7; border-radius: 12px;
    background: #fff; margin-bottom: 1.5rem;
  }
  h1 { font-size: 1.1rem; margin: 0; }
  .badge { font-size: .72rem; font-weight: 600; color: #16a34a; }
  .sealed { display: inline-flex; align-items: center; gap: .35rem; }
  .meta { display: flex; flex-wrap: wrap; gap: .5rem 1.5rem; margin-bottom: 1.5rem; font-size: .9rem; }
  .meta b { font-weight: 600; }
  code {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: .85em;
    background: #f4f4f5; border-radius: 5px; padding: .1rem .35rem;
  }
  table { width: 100%; border-collapse: collapse; font-size: .9rem; }
  .card { border: 1px solid #e4e4e7; border-radius: 12px; overflow: hidden; background: #fff; }
  th, td { text-align: left; padding: .6rem .85rem; border-bottom: 1px solid #f0f0f2; }
  @media (prefers-color-scheme: dark) { th, td { border-color: #1f1f25; } }
  th { font-size: .72rem; text-transform: uppercase; letter-spacing: .04em; color: #71717a; }
  tr:last-child td { border-bottom: none; }
  .type, .scope, .env {
    display: inline-block; font-size: .75rem; padding: .1rem .45rem; border-radius: 999px; background: #f4f4f5;
  }
  .type-string { color: #2563eb; } .type-boolean { color: #9333ea; }
  .type-number { color: #ea580c; } .type-json { color: #0d9488; }
  .muted { color: #a1a1aa; } .empty { text-align: center; color: #71717a; padding: 1.5rem; }
  footer { margin-top: 1.5rem; font-size: .8rem; color: #71717a; }
</style>
</head>
<body>
  <header>
    <h1>Vaultlier <span class="muted">/ ${escapeHtml(snapshot.projectId)}</span></h1>
    <span class="badge sealed">🔒 secrets stay sealed</span>
  </header>

  <div class="meta">
    <span><b>Config:</b> <code>${escapeHtml(snapshot.configFile)}</code></span>
    <span><b>Version:</b> ${snapshot.version}</span>
    <span><b>Environments:</b> ${envChips}</span>
    <span><b>API key:</b> <code>${escapeHtml(snapshot.maskedApiKey ?? "(not cached)")}</code></span>
  </div>

  <div class="card">
    <table>
      <thead>
        <tr><th>Key</th><th>Type</th><th>Scopes</th><th>Default</th></tr>
      </thead>
      <tbody>
${rows}
      </tbody>
    </table>
  </div>

  <footer>
    This view reads <code>${escapeHtml(snapshot.configFile)}</code> on your machine and shows
    <b>metadata only</b> — key names, types, and scopes. Decrypted secret values are never read,
    stored, or displayed here, and nothing leaves your computer.
  </footer>
</body>
</html>
`;
}
