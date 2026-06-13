import { afterEach, describe, expect, it, vi } from "vitest";
import { VaultlierRuntimeError, createClient } from "./index.js";

interface FakeResponseInit {
  status?: number;
  body?: unknown;
  requestId?: string;
}

function fakeResponse(init: FakeResponseInit = {}) {
  const status = init.status ?? 200;
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (name: string) =>
        name.toLowerCase() === "x-request-id" ? (init.requestId ?? null) : null,
    },
    json: async () => init.body ?? {},
  };
}

function stubFetch(
  impl: (url: string, init?: RequestInit) => Promise<unknown>,
) {
  const mock = vi.fn(impl);
  vi.stubGlobal("fetch", mock);
  return mock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("createClient", () => {
  const projectId = "prj_checkout_api";
  const apiKey = "vlt_live_0123456789abcdef";

  it("throws auth/missing_api_key when no key is available", async () => {
    vi.stubEnv("VAULTLIER_API_KEY", "");
    const vault = createClient({ projectId });
    await expect(vault({ environment: "dev" })).rejects.toMatchObject({
      name: "VaultlierRuntimeError",
      code: "auth/missing_api_key",
    });
  });

  it("rejects malformed keys locally without echoing the value", async () => {
    const fetchMock = stubFetch(async () => fakeResponse());
    const vault = createClient({ projectId });
    const badKey = "definitely-not-a-key";
    try {
      await vault({ environment: "dev", apiKey: badKey });
      expect.unreachable("expected a VaultlierRuntimeError");
    } catch (err) {
      const runtimeErr = err as VaultlierRuntimeError;
      expect(runtimeErr.code).toBe("auth/invalid_api_key");
      expect(runtimeErr.message).not.toContain(badKey);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fetches the environment config with a bearer key", async () => {
    const fetchMock = stubFetch(async () =>
      fakeResponse({ body: { DATABASE_URL: "postgres://dev" } }),
    );
    const vault = createClient<{ DATABASE_URL: string }>({
      projectId,
      baseUrl: "https://portal.test/",
    });

    const config = await vault({ environment: "dev", apiKey });

    expect(config.DATABASE_URL).toBe("postgres://dev");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]! as [
      string,
      { headers: Record<string, string> },
    ];
    // Trailing slash on baseUrl is normalized; environment is encoded.
    expect(url).toBe(
      "https://portal.test/v1/projects/prj_checkout_api/config?environment=dev",
    );
    expect(init.headers.authorization).toBe(`Bearer ${apiKey}`);
  });

  it("resolves the key from VAULTLIER_API_KEY when not passed explicitly", async () => {
    vi.stubEnv("VAULTLIER_API_KEY", apiKey);
    const fetchMock = stubFetch(async () => fakeResponse({ body: {} }));
    const vault = createClient({ projectId, baseUrl: "https://portal.test" });

    await vault({ environment: "prod" });

    const [, init] = fetchMock.mock.calls[0]! as [
      string,
      { headers: Record<string, string> },
    ];
    expect(init.headers.authorization).toBe(`Bearer ${apiKey}`);
  });

  it("caches per environment by default and refetches with cache: 'none'", async () => {
    const fetchMock = stubFetch(async () => fakeResponse({ body: { A: "1" } }));
    const vault = createClient({ projectId, baseUrl: "https://portal.test" });

    await vault({ environment: "dev", apiKey });
    await vault({ environment: "dev", apiKey });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await vault({ environment: "prod", apiKey });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await vault({ environment: "prod", apiKey, cache: "none" });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("maps HTTP failures to coded errors carrying the request id", async () => {
    stubFetch(async () =>
      fakeResponse({ status: 403, requestId: "req_test_9" }),
    );
    const vault = createClient({ projectId, baseUrl: "https://portal.test" });

    await expect(vault({ environment: "prod", apiKey })).rejects.toMatchObject({
      code: "http/403",
      requestId: "req_test_9",
    });
  });

  it("maps timeouts to network/timeout", async () => {
    stubFetch(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            const err = new Error("aborted");
            err.name = "AbortError";
            reject(err);
          });
        }),
    );
    const vault = createClient({ projectId, baseUrl: "https://portal.test" });

    await expect(
      vault({ environment: "dev", apiKey, timeoutMs: 20 }),
    ).rejects.toMatchObject({ code: "network/timeout" });
  });

  it("wraps transport failures as network/error", async () => {
    stubFetch(async () => {
      throw new Error("ECONNREFUSED");
    });
    const vault = createClient({ projectId, baseUrl: "https://portal.test" });

    await expect(vault({ environment: "dev", apiKey })).rejects.toMatchObject({
      code: "network/error",
    });
  });
});

describe("VaultlierRuntimeError", () => {
  it("serializes only safe fields via toJSON", () => {
    const err = new VaultlierRuntimeError("http/500", "failed", "req_1");
    expect(JSON.parse(JSON.stringify(err))).toEqual({
      name: "VaultlierRuntimeError",
      code: "http/500",
      message: "failed",
      requestId: "req_1",
    });
  });
});
