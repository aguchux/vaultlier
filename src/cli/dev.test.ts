import { afterEach, describe, expect, it, vi } from "vitest";
import {
  renderHtml,
  startDevServer,
  type DevPortal,
  type DevServerHandle,
  type DevServerOptions,
} from "./dev.js";
import type { VaultlierConfig } from "../schema/types.js";

const config: VaultlierConfig = {
  $schema: "https://schema.vaultlier.com/v2/vaultlier.schema.json",
  projectId: "prj_checkout_api",
  version: 3,
  environments: ["dev", "staging", "prod"],
  keys: {
    DATABASE_URL: { type: "string", scopes: ["all"] },
    STRIPE_SECRET: { type: "string", scopes: ["prod"] },
    FEATURE_NEW_FLOW: { type: "boolean", default: false },
  },
};

/** A fully-stubbed portal whose calls are spied on. */
function fakePortal(overrides: Partial<DevPortal> = {}): DevPortal {
  return {
    getValues: vi.fn(async () => ({})),
    setValues: vi.fn(async () => undefined),
    createEnvironment: vi.fn(async () => undefined),
    renameEnvironment: vi.fn(async () => undefined),
    deleteEnvironment: vi.fn(async () => undefined),
    getStorage: vi.fn(async () => ({
      adapterType: "VAULTLIER" as const,
      metadata: null,
      lastTestStatus: null,
    })),
    setStorage: vi.fn(async () => undefined),
    ...overrides,
  };
}

function options(over: Partial<DevServerOptions> = {}): DevServerOptions {
  return {
    config,
    configFile: "vaultlier.json",
    maskedApiKey: "vlt_test…78",
    portal: fakePortal(),
    port: 0,
    ...over,
  };
}

describe("renderHtml", () => {
  it("renders the management UI shell with the project id", () => {
    const html = renderHtml("prj_checkout_api");
    expect(html).toContain("Environment variables");
    expect(html).toContain("Environments");
    expect(html).toContain("Storage backend");
    expect(html).toContain("synced with remote");
  });

  it("escapes HTML in the project id", () => {
    const html = renderHtml("<script>alert(1)</script>");
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("never embeds a raw api key (it stays server-side)", () => {
    const html = renderHtml("prj_checkout_api");
    expect(html).not.toContain("vlt_");
  });
});

describe("startDevServer", () => {
  let handle: DevServerHandle | undefined;

  afterEach(async () => {
    await handle?.close();
    handle = undefined;
  });

  it("serves the HTML UI on loopback", async () => {
    handle = await startDevServer(options());
    expect(handle.url).toContain("127.0.0.1");
    const res = await fetch(handle.url);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(await res.text()).toContain("Environment variables");
  });

  it("GET /api/state returns schema + values + storage, no raw key", async () => {
    const portal = fakePortal({
      getValues: vi.fn(
        async (env: string): Promise<Record<string, string>> =>
          env === "dev" ? { DATABASE_URL: "postgres://localhost/dev" } : {},
      ),
    });
    handle = await startDevServer(options({ portal }));
    const res = await fetch(`${handle.url}api/state`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      projectId: string;
      values: Record<string, Record<string, string>>;
      readOnly: boolean;
      storage: { adapterType: string } | null;
    };
    expect(body.projectId).toBe("prj_checkout_api");
    expect(body.readOnly).toBe(false);
    expect(body.values.dev).toEqual({ DATABASE_URL: "postgres://localhost/dev" });
    expect(body.storage?.adapterType).toBe("VAULTLIER");
    expect(JSON.stringify(body)).not.toContain("vlt_test_");
  });

  it("PUT /api/secrets proxies an overwrite to the portal", async () => {
    const portal = fakePortal();
    handle = await startDevServer(options({ portal }));
    const res = await fetch(`${handle.url}api/secrets`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ environment: "prod", secrets: { STRIPE_SECRET: "sk_live_x" } }),
    });
    expect(res.status).toBe(200);
    expect(portal.setValues).toHaveBeenCalledWith("prod", {
      STRIPE_SECRET: "sk_live_x",
    });
  });

  it("rejects writes to an unknown environment", async () => {
    const portal = fakePortal();
    handle = await startDevServer(options({ portal }));
    const res = await fetch(`${handle.url}api/secrets`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ environment: "nope", secrets: { X: "y" } }),
    });
    expect(res.status).toBe(400);
    expect(portal.setValues).not.toHaveBeenCalled();
  });

  it("proxies environment create / rename / delete", async () => {
    const portal = fakePortal();
    handle = await startDevServer(options({ portal }));
    const base = `${handle.url}api/environments`;
    const json = { "content-type": "application/json" };

    await fetch(base, { method: "POST", headers: json, body: JSON.stringify({ name: "qa" }) });
    await fetch(base, { method: "PATCH", headers: json, body: JSON.stringify({ name: "qa", to: "test" }) });
    await fetch(base, { method: "DELETE", headers: json, body: JSON.stringify({ name: "test" }) });

    expect(portal.createEnvironment).toHaveBeenCalledWith("qa");
    expect(portal.renameEnvironment).toHaveBeenCalledWith("qa", "test");
    expect(portal.deleteEnvironment).toHaveBeenCalledWith("test");
  });

  it("PUT /api/storage proxies the backend change", async () => {
    const portal = fakePortal();
    handle = await startDevServer(options({ portal }));
    const res = await fetch(`${handle.url}api/storage`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        adapterType: "S3",
        config: { bucket: "b", region: "us-east-1", accessKeyId: "a", secretAccessKey: "s" },
      }),
    });
    expect(res.status).toBe(200);
    expect(portal.setStorage).toHaveBeenCalledWith("S3", {
      bucket: "b",
      region: "us-east-1",
      accessKeyId: "a",
      secretAccessKey: "s",
    });
  });

  it("is read-only without a portal: state flags it and mutations 403", async () => {
    handle = await startDevServer(
      options({ portal: null, readOnlyReason: "VAULTLIER_API_KEY is not set" }),
    );
    const state = (await (await fetch(`${handle.url}api/state`)).json()) as {
      readOnly: boolean;
      readOnlyReason: string;
    };
    expect(state.readOnly).toBe(true);
    expect(state.readOnlyReason).toContain("VAULTLIER_API_KEY");

    const res = await fetch(`${handle.url}api/secrets`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ environment: "dev", secrets: { X: "y" } }),
    });
    expect(res.status).toBe(403);
  });

  it("404s unknown paths", async () => {
    handle = await startDevServer(options());
    expect((await fetch(`${handle.url}nope`)).status).toBe(404);
  });
});
