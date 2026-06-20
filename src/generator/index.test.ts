import { describe, expect, it } from "vitest";
import { generateClient } from "./index.js";
import type { VaultlierConfig } from "../schema/types.js";

const config: VaultlierConfig = {
  projectId: "prj_checkout_api",
  version: 3,
  environments: ["dev", "staging", "prod"],
  keys: {
    STRIPE_SECRET: { type: "string", scopes: ["prod"] },
    DATABASE_URL: { type: "string", scopes: ["all"] },
    FEATURE_NEW_FLOW: { type: "boolean", default: false },
  },
};

describe("generateClient", () => {
  it("emits the do-not-edit header", () => {
    expect(generateClient(config)).toContain("// auto-generated — do not edit");
  });

  it("maps vault types to TypeScript types", () => {
    const out = generateClient(config);
    expect(out).toContain("STRIPE_SECRET: string;");
    expect(out).toContain("FEATURE_NEW_FLOW: boolean;");
  });

  it("is deterministic with sorted keys", () => {
    const out = generateClient(config);
    const dbIndex = out.indexOf("DATABASE_URL");
    const stripeIndex = out.indexOf("STRIPE_SECRET");
    expect(dbIndex).toBeLessThan(stripeIndex);
    expect(generateClient(config)).toEqual(out);
  });

  it("never emits secret values", () => {
    const out = generateClient(config);
    expect(out).not.toContain("false");
    expect(out).toContain("projectId: 'prj_checkout_api'");
  });
});
