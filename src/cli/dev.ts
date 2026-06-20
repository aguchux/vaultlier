/**
 * `vaultlier dev` — single-project management UI.
 *
 * Starts a small HTTP server (Node-only, no third-party deps) bound to loopback
 * (127.0.0.1) that lets you manage ONE project — the one bound in the local
 * `vaultlier.json` — against the remote Vaultlier store. It is a tiny portal:
 *
 *   • View and edit environment variable VALUES per environment (overwrite).
 *   • View and manage ENVIRONMENTS (create, rename, delete).
 *   • Manage the STORAGE backend (Vaultlier, S3, Postgres) — updates remote.
 *
 * Every change is written straight through to the remote, so the UI is always
 * in sync with the Vaultlier store. The browser never receives the API key:
 * it calls this loopback server, which proxies to the portal using a key held
 * only in this process's memory. Mutations require an interactive terminal-
 * resolved key with the appropriate role (MEMBER+ for values/environments,
 * ADMIN+ for storage), exactly as the portal enforces.
 */

import { createServer, type Server } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import type { VaultlierConfig } from "../schema/types.js";

/** Coerce a JSON body field to a string without "[object Object]" surprises. */
function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export const DEV_PORT = 9090;
export const DEV_HOST = "127.0.0.1";

/** Per-environment resolved values (held in memory only, never written to disk). */
export type EnvironmentValues = Record<string, Record<string, string>>;

export interface StorageView {
  adapterType: "VAULTLIER" | "S3" | "POSTGRES";
  metadata: Record<string, unknown> | null;
  lastTestStatus: string | null;
}

/**
 * The remote operations the dev UI performs. Injected so the server is
 * transport-agnostic and unit-testable; the CLI wires these to the portal
 * client bound with the in-memory API key.
 */
export interface DevPortal {
  /** Fetch values for one environment (decrypted; stays in this process). */
  getValues(environment: string): Promise<Record<string, string>>;
  /** Overwrite one or more KEY=VALUE pairs in an environment. */
  setValues(
    environment: string,
    secrets: Record<string, string>,
  ): Promise<void>;
  createEnvironment(name: string): Promise<void>;
  renameEnvironment(name: string, to: string): Promise<void>;
  deleteEnvironment(name: string): Promise<void>;
  getStorage(): Promise<StorageView>;
  setStorage(
    adapterType: StorageView["adapterType"],
    config: Record<string, unknown>,
  ): Promise<void>;
}

export interface DevServerOptions {
  config: VaultlierConfig;
  configFile: string;
  /** Masked API key for display only; never the raw value. */
  maskedApiKey: string | null;
  /** Remote operations, or null when no API key is available (read-only). */
  portal: DevPortal | null;
  /** Reason the UI is read-only (e.g. no API key), shown as a banner. */
  readOnlyReason?: string | null;
  port?: number;
  host?: string;
}

export interface DevServerHandle {
  url: string;
  port: number;
  close: () => Promise<void>;
}

interface StateResponse {
  projectId: string;
  configFile: string;
  maskedApiKey: string | null;
  readOnly: boolean;
  readOnlyReason: string | null;
  environments: string[];
  keys: Array<{ name: string; type: string; scopes: string[] }>;
  values: EnvironmentValues;
  storage: StorageView | null;
}

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
} as const;

/**
 * Start the dev management server. Resolves once listening. State is fetched
 * live from the remote on each `GET /api/state`, so the UI reflects the current
 * Vaultlier store rather than a start-time snapshot.
 */
export function startDevServer(
  options: DevServerOptions,
): Promise<DevServerHandle> {
  const port = options.port ?? DEV_PORT;
  const host = options.host ?? DEV_HOST;
  const html = renderHtml(options.config.projectId);

  const server: Server = createServer((req, res) => {
    handleRequest(req, res, options, html).catch((err) => {
      sendJson(res, 500, {
        error: err instanceof Error ? err.message : "internal error",
      });
    });
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      const address = server.address() as AddressInfo;
      resolve({
        url: `http://${host}:${address.port}/`,
        port: address.port,
        close: () =>
          new Promise<void>((res, rej) =>
            server.close((err) => (err ? rej(err) : res())),
          ),
      });
    });
  });
}

async function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
  options: DevServerOptions,
  html: string,
): Promise<void> {
  const url = req.url ?? "/";
  const method = req.method ?? "GET";

  if (method === "GET" && (url === "/" || url === "/index.html")) {
    res.writeHead(200, {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    });
    res.end(html);
    return;
  }

  if (method === "GET" && url === "/api/state") {
    sendJson(res, 200, await buildState(options));
    return;
  }

  // Everything below mutates and requires a portal (API key) to be available.
  if (url.startsWith("/api/")) {
    if (!options.portal) {
      sendJson(res, 403, {
        error: options.readOnlyReason ?? "remote operations are unavailable",
      });
      return;
    }
    try {
      await handleMutation(req, res, url, method, options.portal, options.config);
    } catch (err) {
      sendJson(res, 400, {
        error: err instanceof Error ? err.message : String(err),
      });
    }
    return;
  }

  sendJson(res, 404, { error: "not found" });
}

async function handleMutation(
  req: IncomingMessage,
  res: ServerResponse,
  url: string,
  method: string,
  portal: DevPortal,
  config: VaultlierConfig,
): Promise<void> {
  const body = await readJsonBody(req);

  if (url === "/api/secrets" && method === "PUT") {
    const environment = asString(body.environment);
    const secrets = body.secrets;
    if (!config.environments.includes(environment)) {
      throw new Error(`Unknown environment "${environment}".`);
    }
    if (secrets === null || typeof secrets !== "object" || Array.isArray(secrets)) {
      throw new Error("`secrets` must be an object of key/value pairs.");
    }
    const normalized: Record<string, string> = {};
    for (const [key, value] of Object.entries(secrets as Record<string, unknown>)) {
      normalized[key] = typeof value === "string" ? value : JSON.stringify(value);
    }
    await portal.setValues(environment, normalized);
    sendJson(res, 200, { ok: true });
    return;
  }

  if (url === "/api/environments" && method === "POST") {
    await portal.createEnvironment(asString(body.name));
    sendJson(res, 200, { ok: true });
    return;
  }
  if (url === "/api/environments" && method === "PATCH") {
    await portal.renameEnvironment(asString(body.name), asString(body.to));
    sendJson(res, 200, { ok: true });
    return;
  }
  if (url === "/api/environments" && method === "DELETE") {
    await portal.deleteEnvironment(asString(body.name));
    sendJson(res, 200, { ok: true });
    return;
  }

  if (url === "/api/storage" && method === "PUT") {
    const adapterType = body.adapterType as StorageView["adapterType"];
    const cfg =
      body.config && typeof body.config === "object"
        ? (body.config as Record<string, unknown>)
        : {};
    await portal.setStorage(adapterType, cfg);
    sendJson(res, 200, { ok: true });
    return;
  }

  sendJson(res, 404, { error: "not found" });
}

/** Assemble the live state the UI renders: schema + per-env values + storage. */
async function buildState(options: DevServerOptions): Promise<StateResponse> {
  const { config, portal } = options;
  const keys = Object.entries(config.keys).map(([name, schema]) => ({
    name,
    type: schema.type,
    scopes: schema.scopes ?? ["all"],
  }));

  const values: EnvironmentValues = {};
  let storage: StorageView | null = null;
  let readOnlyReason = options.readOnlyReason ?? null;

  if (portal) {
    // Fetch values for every environment in parallel; tolerate per-env failures
    // (e.g. an env with no values yet) without failing the whole page.
    await Promise.all(
      config.environments.map(async (env) => {
        try {
          values[env] = await portal.getValues(env);
        } catch {
          values[env] = {};
        }
      }),
    );
    try {
      storage = await portal.getStorage();
    } catch {
      storage = null;
    }
  } else {
    for (const env of config.environments) values[env] = {};
    readOnlyReason = readOnlyReason ?? "No API key — connect one to manage this project.";
  }

  return {
    projectId: config.projectId,
    configFile: options.configFile,
    maskedApiKey: options.maskedApiKey,
    readOnly: !portal,
    readOnlyReason,
    environments: config.environments,
    keys,
    values,
    storage,
  };
}

function sendJson(
  res: ServerResponse,
  status: number,
  payload: unknown,
): void {
  res.writeHead(status, JSON_HEADERS);
  res.end(JSON.stringify(payload));
}

function readJsonBody(
  req: IncomingMessage,
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let raw = "";
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      // Cap body size; secret values are small. 256 KB is generous.
      if (size > 256 * 1024) {
        reject(new Error("request body too large"));
        req.destroy();
        return;
      }
      raw += chunk.toString("utf8");
    });
    req.on("end", () => {
      if (raw.trim() === "") return resolve({});
      try {
        const parsed = JSON.parse(raw) as unknown;
        if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
          reject(new Error("body must be a JSON object"));
          return;
        }
        resolve(parsed as Record<string, unknown>);
      } catch {
        reject(new Error("body must be valid JSON"));
      }
    });
    req.on("error", reject);
  });
}

/**
 * Render the self-contained management UI. No external assets. The page fetches
 * live state from /api/state and posts changes back through this loopback
 * server; the API key never reaches the browser.
 */
export function renderHtml(projectId: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Vaultlier · ${escapeHtml(projectId)}</title>
<script>
  // Apply the saved (or system) theme before paint to avoid a flash.
  (function () {
    try {
      var t = localStorage.getItem("vaultlier-dev-theme");
      if (!t) t = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      document.documentElement.setAttribute("data-theme", t);
    } catch (e) { document.documentElement.setAttribute("data-theme", "light"); }
  })();
</script>
<style>
  /* Light theme tokens (security-emerald brand, flat surfaces). */
  :root {
    --bg:#ffffff; --surface:#ffffff; --surface-2:#f4f6f5; --fg:#0b0f0c; --muted:#5b6b61;
    --border:#d6ddd9; --border-strong:#b3bdb7; --brand:#059669; --brand-fg:#ffffff;
    --accent-bg:#ecfdf5; --accent-fg:#047857; --danger:#dc2626; --danger-bg:#fef2f2;
    --warn-fg:#92590a; --warn-bg:#fffbeb; --warn-border:#fde68a; --ring:#34d39955;
    --shadow: none;
  }
  [data-theme="dark"] {
    --bg:#0b0f0c; --surface:#11161300; --surface:#121814; --surface-2:#0e1310; --fg:#e8ecea; --muted:#9aa8a0;
    --border:#222c26; --border-strong:#33403a; --brand:#10b981; --brand-fg:#04140d;
    --accent-bg:#10b9811f; --accent-fg:#6ee7b7; --danger:#f87171; --danger-bg:#7f1d1d22;
    --warn-fg:#fbbf24; --warn-bg:#3a2c0a; --warn-border:#5b4708; --ring:#10b98155;
    --shadow: none;
  }
  * { box-sizing: border-box; }
  html, body { background: var(--bg); }
  body {
    font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
    margin: 0; padding: 0 1.25rem 5rem; line-height: 1.55; color: var(--fg);
    -webkit-font-smoothing: antialiased;
  }
  .wrap { max-width: 64rem; margin-inline: auto; }
  header {
    position: sticky; top: 0; z-index: 5; display:flex; align-items:center; justify-content:space-between;
    gap:1rem; padding:1rem 0; margin-bottom:1.5rem; border-bottom:1px solid var(--border);
    background: var(--bg);
  }
  .brand { display:flex; align-items:center; gap:.6rem; }
  .logo { width:1.4rem; height:1.4rem; display:grid; place-items:center; background:var(--brand);
    color:var(--brand-fg); border-radius:4px; font-weight:800; font-size:.85rem; }
  h1 { font-size:1rem; margin:0; font-weight:700; letter-spacing:-.01em; }
  h2 { font-size:.82rem; margin:0 0 1rem; text-transform:uppercase; letter-spacing:.06em; color:var(--muted); font-weight:700; }
  .head-right { display:flex; align-items:center; gap:.85rem; }
  .muted { color:var(--muted); }
  .badge { display:inline-flex; align-items:center; gap:.4rem; font-size:.72rem; font-weight:600;
    color:var(--accent-fg); background:var(--accent-bg); padding:.2rem .5rem; border-radius:4px; }
  .badge::before { content:""; width:.45rem; height:.45rem; border-radius:50%; background:var(--brand); }
  .themebtn { font:inherit; cursor:pointer; background:transparent; border:1px solid var(--border);
    color:var(--fg); border-radius:4px; padding:.3rem .55rem; font-size:.95rem; line-height:1; }
  .themebtn:hover { border-color:var(--border-strong); }
  .card { border:1px solid var(--border); background:var(--surface); padding:1.25rem 1.35rem; margin-bottom:1.25rem; border-radius:2px; }
  .tabs { display:flex; gap:0; flex-wrap:wrap; margin-bottom:1.1rem; border:1px solid var(--border); border-radius:3px; overflow:hidden; width:fit-content; }
  .tab { border:none; border-right:1px solid var(--border); background:var(--surface); color:var(--fg);
    padding:.4rem .9rem; font:inherit; font-size:.85rem; cursor:pointer; }
  .tab:last-child { border-right:none; }
  .tab:hover:not(.active) { background:var(--surface-2); }
  .tab.active { background:var(--brand); color:var(--brand-fg); font-weight:600; }
  table { width:100%; border-collapse:collapse; font-size:.88rem; }
  th,td { text-align:left; padding:.6rem .7rem; border-bottom:1px solid var(--border); vertical-align:middle; }
  thead th { font-size:.68rem; text-transform:uppercase; letter-spacing:.05em; color:var(--muted); font-weight:700;
    border-bottom:1px solid var(--border-strong); }
  tbody tr:last-child td { border-bottom:none; }
  tbody tr:hover { background:var(--surface-2); }
  code, .mono { font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; font-size:.85em; }
  input,select,textarea {
    font:inherit; padding:.5rem .6rem; border:1px solid var(--border); background:var(--bg); color:var(--fg);
    border-radius:3px; width:100%; transition:border-color .12s, box-shadow .12s;
  }
  input:focus,select:focus,textarea:focus { outline:none; border-color:var(--brand); box-shadow:0 0 0 3px var(--ring); }
  input:disabled,select:disabled { color:var(--muted); background:var(--surface-2); cursor:not-allowed; }
  input.val { font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; font-size:.85rem; }
  button.act { font:inherit; cursor:pointer; border:1px solid transparent; border-radius:3px;
    padding:.45rem .85rem; font-size:.82rem; font-weight:600; transition:filter .12s, background .12s; }
  button.act:hover { filter:brightness(1.06); }
  .primary { background:var(--brand); color:var(--brand-fg); }
  .ghost { background:transparent; border-color:var(--border); color:var(--fg); }
  .ghost:hover { background:var(--surface-2); filter:none; }
  .danger { background:transparent; color:var(--danger); border-color:var(--border); }
  .danger:hover { background:var(--danger-bg); filter:none; }
  .row { display:flex; gap:.55rem; align-items:center; }
  .pill { display:inline-block; font-size:.72rem; padding:.12rem .5rem; border:1px solid var(--border);
    border-radius:3px; color:var(--muted); background:var(--surface-2); }
  .envrow { display:flex; gap:.55rem; align-items:center; padding:.55rem .1rem; border-bottom:1px solid var(--border); }
  .envrow:last-child { border-bottom:none; }
  .toast { position:fixed; bottom:1.25rem; left:50%; transform:translateX(-50%) translateY(.5rem); padding:.65rem 1.1rem;
    border-radius:3px; background:var(--fg); color:var(--bg); font-size:.85rem; font-weight:500;
    opacity:0; transition:opacity .18s, transform .18s; pointer-events:none; box-shadow:0 6px 24px rgba(0,0,0,.25); }
  .toast.show { opacity:1; transform:translateX(-50%) translateY(0); }
  .toast.err { background:var(--danger); color:#fff; }
  .warn { border:1px solid var(--warn-border); background:var(--warn-bg); color:var(--warn-fg);
    border-radius:3px; padding:.7rem .95rem; margin-bottom:1.25rem; font-size:.88rem; }
  .field { margin-bottom:.85rem; } .field label { display:block; font-size:.76rem; font-weight:600; margin-bottom:.3rem; color:var(--muted); }
  .grid2 { display:grid; gap:.85rem; grid-template-columns:1fr 1fr; }
  .actions { margin-top:1rem; display:flex; gap:.6rem; align-items:center; }
  .empty { text-align:center; color:var(--muted); padding:1.5rem; }
  .hide { display:none; }
  @media (max-width:560px) { .grid2 { grid-template-columns:1fr; } }
</style>
</head>
<body>
  <div class="wrap">
    <header>
      <div class="brand">
        <span class="logo">V</span>
        <h1>Vaultlier <span class="muted" style="font-weight:500">/ <code id="pid"></code></span></h1>
      </div>
      <div class="head-right">
        <span class="badge">live · synced with remote</span>
        <button class="themebtn" id="themebtn" onclick="toggleTheme()" title="Toggle theme" aria-label="Toggle theme"></button>
      </div>
    </header>
    <div id="warn" class="warn hide"></div>

    <div class="card">
      <h2>Environment variables</h2>
      <div class="tabs" id="envtabs"></div>
      <table>
        <thead><tr><th>Key</th><th>Type</th><th style="width:48%">Value</th><th></th></tr></thead>
        <tbody id="vars"></tbody>
      </table>
    </div>

    <div class="card">
      <h2>Environments</h2>
      <div id="envlist"></div>
      <div class="actions">
        <input id="newenv" placeholder="new environment (e.g. staging)" style="max-width:20rem" />
        <button class="act primary" onclick="addEnv()">Add environment</button>
      </div>
    </div>

    <div class="card">
      <h2>Storage backend</h2>
      <div class="field">
        <label>Backend</label>
        <select id="adapter" onchange="onAdapter()">
          <option value="VAULTLIER">Vaultlier-managed (default)</option>
          <option value="S3">Amazon S3 (or R2 / MinIO)</option>
          <option value="POSTGRES">Postgres</option>
        </select>
      </div>
      <div id="s3fields" class="hide">
        <div class="grid2">
          <div class="field"><label>Bucket</label><input id="s3_bucket" /></div>
          <div class="field"><label>Region</label><input id="s3_region" /></div>
          <div class="field"><label>Access key ID</label><input id="s3_accessKeyId" autocomplete="off" /></div>
          <div class="field"><label>Secret access key</label><input id="s3_secretAccessKey" type="password" autocomplete="off" /></div>
          <div class="field"><label>Endpoint (optional)</label><input id="s3_endpoint" placeholder="R2 / MinIO" /></div>
          <div class="field"><label>Prefix (optional)</label><input id="s3_prefix" /></div>
        </div>
      </div>
      <div id="pgfields" class="hide">
        <div class="field"><label>Connection string</label><input id="pg_connectionString" type="password" autocomplete="off" placeholder="postgresql://…" /></div>
      </div>
      <div class="actions">
        <button class="act primary" onclick="saveStorage()">Save backend</button>
        <span class="muted" id="storagestatus"></span>
      </div>
    </div>
  </div>

  <div class="toast" id="toast"></div>

<script>
const $ = (id) => document.getElementById(id);
let state = null, activeEnv = null;

function currentTheme() { return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light"; }
function applyThemeIcon() { $("themebtn").textContent = currentTheme() === "dark" ? "☀" : "☾"; }
function toggleTheme() {
  const next = currentTheme() === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  try { localStorage.setItem("vaultlier-dev-theme", next); } catch (e) {}
  applyThemeIcon();
}

function toast(msg, err) {
  const t = $("toast"); t.textContent = msg; t.className = "toast show" + (err ? " err" : "");
  setTimeout(() => { t.className = "toast"; }, err ? 4000 : 2000);
}
async function api(method, path, body) {
  const res = await fetch(path, { method, headers: body ? { "content-type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || ("request failed: " + res.status));
  return data;
}
function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c])); }

async function load() {
  applyThemeIcon();
  state = await api("GET", "/api/state");
  $("pid").textContent = state.projectId;
  if (state.readOnly) { $("warn").textContent = "⚠ " + (state.readOnlyReason || "read-only"); $("warn").classList.remove("hide"); }
  else { $("warn").classList.add("hide"); }
  if (!activeEnv || !state.environments.includes(activeEnv)) activeEnv = state.environments[0] || null;
  renderTabs(); renderVars(); renderEnvList(); renderStorage();
}
function renderTabs() {
  $("envtabs").innerHTML = state.environments.map(e =>
    '<button class="tab ' + (e === activeEnv ? "active" : "") + '" onclick="pickEnv(\\'' + esc(e) + '\\')">' + esc(e) + '</button>').join("");
}
function pickEnv(e) { activeEnv = e; renderTabs(); renderVars(); }
function inScope(key) { return key.scopes.includes("all") || key.scopes.includes(activeEnv); }
function renderVars() {
  const vals = (state.values && state.values[activeEnv]) || {};
  const rows = state.keys.filter(inScope).map(k => {
    const v = vals[k.name] != null ? vals[k.name] : "";
    return '<tr><td><code>' + esc(k.name) + '</code></td><td><span class="pill">' + esc(k.type) + '</span></td>' +
      '<td><input class="val" id="v_' + esc(k.name) + '" value="' + esc(v) + '" ' + (state.readOnly ? "disabled" : "") + ' /></td>' +
      '<td>' + (state.readOnly ? "" : '<button class="act primary" onclick="saveVar(\\'' + esc(k.name) + '\\')">Save</button>') + '</td></tr>';
  }).join("");
  $("vars").innerHTML = rows || '<tr><td colspan="4" class="empty">No keys scoped to this environment. Add keys via <code>vaultlier push</code>.</td></tr>';
}
async function saveVar(name) {
  try {
    const value = $("v_" + name).value;
    await api("PUT", "/api/secrets", { environment: activeEnv, secrets: { [name]: value } });
    toast(name + " saved to " + activeEnv);
  } catch (e) { toast(e.message, true); }
}
function renderEnvList() {
  $("envlist").innerHTML = state.environments.map(e =>
    '<div class="envrow"><code style="flex:1;min-width:9rem">' + esc(e) + '</code>' +
    (state.readOnly ? "" :
      '<button class="act ghost" onclick="renameEnv(\\'' + esc(e) + '\\')">Rename</button>' +
      '<button class="act danger" onclick="deleteEnv(\\'' + esc(e) + '\\')">Delete</button>') +
    '</div>').join("") || '<div class="empty">No environments yet.</div>';
}
async function addEnv() {
  try { const name = $("newenv").value.trim(); if (!name) return;
    await api("POST", "/api/environments", { name }); $("newenv").value = ""; toast("environment created"); await load();
  } catch (e) { toast(e.message, true); }
}
async function renameEnv(name) {
  const to = prompt("Rename \\"" + name + "\\" to:", name); if (!to || to === name) return;
  try { await api("PATCH", "/api/environments", { name, to }); toast("renamed"); if (activeEnv === name) activeEnv = to; await load(); }
  catch (e) { toast(e.message, true); }
}
async function deleteEnv(name) {
  if (!confirm("Delete environment \\"" + name + "\\"? It must have no values.")) return;
  try { await api("DELETE", "/api/environments", { name }); toast("deleted"); await load(); }
  catch (e) { toast(e.message, true); }
}
function onAdapter() {
  const a = $("adapter").value;
  $("s3fields").classList.toggle("hide", a !== "S3");
  $("pgfields").classList.toggle("hide", a !== "POSTGRES");
}
function renderStorage() {
  const s = state.storage;
  if (s) { $("adapter").value = s.adapterType;
    const m = s.metadata || {};
    if (s.adapterType === "S3") { $("s3_bucket").value = m.bucket || ""; $("s3_region").value = m.region || ""; $("s3_endpoint").value = m.endpoint || ""; }
    $("storagestatus").textContent = s.lastTestStatus ? ("last test: " + s.lastTestStatus.toLowerCase()) : "";
  }
  $("adapter").disabled = state.readOnly;
  onAdapter();
}
async function saveStorage() {
  const adapterType = $("adapter").value; let config = {};
  if (adapterType === "S3") config = { bucket:$("s3_bucket").value.trim(), region:$("s3_region").value.trim(),
    accessKeyId:$("s3_accessKeyId").value.trim(), secretAccessKey:$("s3_secretAccessKey").value,
    endpoint:$("s3_endpoint").value.trim(), prefix:$("s3_prefix").value.trim() };
  else if (adapterType === "POSTGRES") config = { connectionString:$("pg_connectionString").value.trim() };
  try { await api("PUT", "/api/storage", { adapterType, config }); toast("storage backend saved"); await load(); }
  catch (e) { toast(e.message, true); }
}
load().catch(e => { $("warn").textContent = "⚠ " + e.message; $("warn").classList.remove("hide"); });
</script>
</body>
</html>
`;
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
