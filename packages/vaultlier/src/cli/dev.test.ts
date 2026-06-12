import { afterEach, describe, expect, it } from "vitest";
import {
  buildSnapshot,
  renderHtml,
  startDevServer,
  type DevServerHandle,
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

describe("buildSnapshot", () => {
  it("captures metadata only and never secret values", () => {
    const snap = buildSnapshot({
      config,
      configFile: "vaultlier.json",
      maskedApiKey: "vlt_test…78",
    });
    expect(snap.projectId).toBe("prj_checkout_api");
    expect(snap.environments).toEqual(["dev", "staging", "prod"]);
    expect(snap.keys).toHaveLength(3);
    expect(snap.keys[0]).toMatchObject({ name: "DATABASE_URL", type: "string" });
    // Snapshot must not carry a raw apiKey, only the masked form.
    expect(JSON.stringify(snap)).not.toContain("vlt_test_");
    expect(snap.maskedApiKey).toBe("vlt_test…78");
  });

  it("defaults scopes to ['all'] when absent", () => {
    const snap = buildSnapshot({
      config: { ...config, keys: { X: { type: "number" } } },
      configFile: "vaultlier.json",
      maskedApiKey: null,
    });
    expect(snap.keys[0]!.scopes).toEqual(["all"]);
  });

  it("defaults remote and remoteWarning to null", () => {
    const snap = buildSnapshot({
      config,
      configFile: "vaultlier.json",
      maskedApiKey: null,
    });
    expect(snap.remote).toBeNull();
    expect(snap.remoteWarning).toBeNull();
  });

  it("stringifies non-string remote values for display", () => {
    const snap = buildSnapshot({
      config,
      configFile: "vaultlier.json",
      maskedApiKey: null,
      remote: {
        environment: "dev",
        values: {
          DATABASE_URL: "postgres://localhost/dev",
          FEATURE_NEW_FLOW: true,
          RETRIES: 3,
        },
      },
    });
    expect(snap.remote).toEqual({
      environment: "dev",
      values: {
        DATABASE_URL: "postgres://localhost/dev",
        FEATURE_NEW_FLOW: "true",
        RETRIES: "3",
      },
    });
  });
});

describe("renderHtml", () => {
  const snap = buildSnapshot({
    config,
    configFile: "vaultlier.json",
    maskedApiKey: "vlt_test…78",
  });

  it("renders the sealed-secrets messaging", () => {
    const html = renderHtml(snap);
    expect(html).toContain("secrets stay sealed");
    expect(html).toContain("metadata only");
    expect(html).toContain("DATABASE_URL");
  });

  it("escapes HTML in untrusted config values", () => {
    const evil = buildSnapshot({
      config: {
        ...config,
        projectId: "<script>alert(1)</script>",
        keys: {},
      },
      configFile: "vaultlier.json",
      maskedApiKey: null,
    });
    const html = renderHtml(evil);
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("never embeds an unmasked api key", () => {
    expect(renderHtml(snap)).not.toContain("vlt_test_12345678");
  });

  it("omits the value column when no remote values were fetched", () => {
    const html = renderHtml(snap);
    expect(html).not.toContain("Value (");
  });

  it("renders dev values in a dedicated column when fetched", () => {
    const html = renderHtml(
      buildSnapshot({
        config,
        configFile: "vaultlier.json",
        maskedApiKey: "vlt_test…78",
        remote: {
          environment: "dev",
          values: { DATABASE_URL: "postgres://localhost/dev" },
        },
      }),
    );
    expect(html).toContain("Value (dev)");
    expect(html).toContain("postgres://localhost/dev");
    expect(html).toContain("dev values only — other envs stay sealed");
  });

  it("escapes HTML in remote values", () => {
    const html = renderHtml(
      buildSnapshot({
        config,
        configFile: "vaultlier.json",
        maskedApiKey: null,
        remote: {
          environment: "dev",
          values: { DATABASE_URL: "<img onerror=alert(1)>" },
        },
      }),
    );
    expect(html).not.toContain("<img onerror=alert(1)>");
    expect(html).toContain("&lt;img onerror=alert(1)&gt;");
  });

  it("renders a warning banner when the API key is missing", () => {
    const html = renderHtml(
      buildSnapshot({
        config,
        configFile: "vaultlier.json",
        maskedApiKey: null,
        remoteWarning:
          "VAULTLIER_API_KEY is not set — remote values are unavailable. Set VAULTLIER_API_KEY to access remote environments.",
      }),
    );
    expect(html).toContain('class="warning"');
    expect(html).toContain("VAULTLIER_API_KEY is not set");
    // No remote values, so the metadata-only guarantees still hold.
    expect(html).toContain("secrets stay sealed");
    expect(html).not.toContain("Value (");
  });
});

describe("startDevServer", () => {
  let handle: DevServerHandle | undefined;

  afterEach(async () => {
    await handle?.close();
    handle = undefined;
  });

  it("serves the HTML dashboard on loopback", async () => {
    const snap = buildSnapshot({
      config,
      configFile: "vaultlier.json",
      maskedApiKey: null,
    });
    // port 0 = ephemeral, avoids clashing with a real 9090 during tests.
    handle = await startDevServer(snap, { port: 0 });
    expect(handle.url).toContain("127.0.0.1");

    const res = await fetch(handle.url);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(await res.text()).toContain("secrets stay sealed");
  });

  it("exposes the snapshot as JSON without secrets", async () => {
    const snap = buildSnapshot({
      config,
      configFile: "vaultlier.json",
      maskedApiKey: "vlt_test…78",
    });
    handle = await startDevServer(snap, { port: 0 });
    const res = await fetch(`${handle.url}api/snapshot`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { projectId: string };
    expect(body.projectId).toBe("prj_checkout_api");
    expect(JSON.stringify(body)).not.toContain("vlt_test_");
  });

  it("404s unknown paths and rejects non-GET", async () => {
    handle = await startDevServer(
      buildSnapshot({ config, configFile: "vaultlier.json", maskedApiKey: null }),
      { port: 0 },
    );
    expect((await fetch(`${handle.url}nope`)).status).toBe(404);
    expect((await fetch(handle.url, { method: "POST" })).status).toBe(405);
  });
});
