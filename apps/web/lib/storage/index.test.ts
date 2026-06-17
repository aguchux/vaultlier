import { beforeEach, describe, expect, it, vi } from "vitest";

// vi.mock is hoisted above the module body, so the spies it references must be
// created via vi.hoisted (which runs first) rather than plain top-level consts.
const { findUnique, put, get, test } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  put: vi.fn(),
  get: vi.fn(),
  test: vi.fn(),
}));

// Mock the DB so getExternalAdapter reads a config we control.
vi.mock("@vaultlier/db", () => ({
  prisma: { storageAdapterConfig: { findUnique } },
}));

// Mock decryptSecret so config decryption is deterministic and env-free.
vi.mock("../vault-crypto", () => ({
  decryptSecret: () => JSON.stringify({ connectionString: "postgres://x" }),
}));

// Mock the adapters so we control put/get/test without real network/DB.
vi.mock("./adapters/postgres", () => ({
  PostgresAdapter: class {
    readonly type = "POSTGRES" as const;
    put = put;
    get = get;
    remove = vi.fn();
    test = test;
  },
}));
vi.mock("./adapters/s3", () => ({ S3Adapter: class {} }));

import {
  buildAdapter,
  getExternalAdapter,
  readExternal,
  writeSealed,
} from "./index";

const project = { id: "p1", publicId: "prj_test" };
const ref = { environment: "prod", keyName: "API_KEY", version: 1 };
const blob = {
  ciphertext: new Uint8Array([1]),
  nonce: new Uint8Array([2]),
  authTag: new Uint8Array([3]),
  kekId: "mk1",
};

function configRow(adapterType: string) {
  return {
    adapterType,
    ciphertext: Buffer.from([1]),
    nonce: Buffer.from([2]),
    authTag: Buffer.from([3]),
    kekId: "mk1",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("buildAdapter", () => {
  it("returns null for the default Vaultlier-managed backend", () => {
    expect(buildAdapter(project, "VAULTLIER", {} as never)).toBeNull();
  });
});

describe("getExternalAdapter", () => {
  it("returns null when no config row exists (default store)", async () => {
    findUnique.mockResolvedValue(null);
    expect(await getExternalAdapter(project)).toBeNull();
  });

  it("returns null when the config is VAULTLIER", async () => {
    findUnique.mockResolvedValue(configRow("VAULTLIER"));
    expect(await getExternalAdapter(project)).toBeNull();
  });

  it("builds an adapter for an external backend", async () => {
    findUnique.mockResolvedValue(configRow("POSTGRES"));
    const adapter = await getExternalAdapter(project);
    expect(adapter?.type).toBe("POSTGRES");
  });
});

describe("writeSealed", () => {
  it("does not need resync when there is no external store", async () => {
    findUnique.mockResolvedValue(null);
    expect(await writeSealed(project, ref, blob)).toEqual({ needsResync: false });
    expect(put).not.toHaveBeenCalled();
  });

  it("does not need resync when the external write succeeds", async () => {
    findUnique.mockResolvedValue(configRow("POSTGRES"));
    put.mockResolvedValue(undefined);
    expect(await writeSealed(project, ref, blob)).toEqual({ needsResync: false });
    expect(put).toHaveBeenCalledOnce();
  });

  it("flags resync (without throwing) when the external write fails", async () => {
    findUnique.mockResolvedValue(configRow("POSTGRES"));
    put.mockRejectedValue(new Error("network down"));
    expect(await writeSealed(project, ref, blob)).toEqual({ needsResync: true });
  });
});

describe("readExternal", () => {
  it("returns null (use DB fallback) when no external store", async () => {
    findUnique.mockResolvedValue(null);
    expect(await readExternal(project, ref)).toBeNull();
  });

  it("returns the external blob on a hit", async () => {
    findUnique.mockResolvedValue(configRow("POSTGRES"));
    get.mockResolvedValue(blob);
    expect(await readExternal(project, ref)).toBe(blob);
  });

  it("degrades to null (DB fallback) when the external read throws", async () => {
    findUnique.mockResolvedValue(configRow("POSTGRES"));
    get.mockRejectedValue(new Error("timeout"));
    expect(await readExternal(project, ref)).toBeNull();
  });
});
