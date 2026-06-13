import { describe, expect, it } from "vitest";
import {
  environmentDeletionBlockers,
  isValidEnvironmentName,
  normalizeEnvironmentName,
  organizationDeletionBlockers,
  replaceEnvironmentScope,
} from "./resource-policy";

describe("resource deletion policies", () => {
  it("allows deletion of an empty organization with only its owner", () => {
    expect(
      organizationDeletionBlockers({
        projectCount: 0,
        memberCount: 1,
        pendingInvitationCount: 0,
      }),
    ).toEqual([]);
  });

  it("reports all operational organization links", () => {
    expect(
      organizationDeletionBlockers({
        projectCount: 2,
        memberCount: 3,
        pendingInvitationCount: 1,
      }),
    ).toEqual(["2 projects", "2 other members", "1 pending invitation"]);
  });

  it("blocks environment deletion for values and scoped keys", () => {
    expect(
      environmentDeletionBlockers({ keyVersionCount: 4, scopedKeyCount: 2 }),
    ).toEqual(["4 encrypted value versions", "2 scoped keys"]);
  });
});

describe("environment names", () => {
  it("normalizes names before validation", () => {
    expect(normalizeEnvironmentName("  Staging_US ")).toBe("staging_us");
  });

  it("accepts safe names and rejects unsupported names", () => {
    expect(isValidEnvironmentName("prod-eu_1")).toBe(true);
    expect(isValidEnvironmentName("1prod")).toBe(false);
    expect(isValidEnvironmentName("prod eu")).toBe(false);
    expect(isValidEnvironmentName("a".repeat(33))).toBe(false);
  });

  it("renames environment scopes without creating duplicates", () => {
    expect(
      replaceEnvironmentScope(["dev", "staging", "prod"], "staging", "prod"),
    ).toEqual(["dev", "prod"]);
  });
});
