import { describe, expect, it } from "vitest";
import {
  canInviteRole,
  canManageOrganization,
  canManageProject,
  canManageRole,
} from "./rbac";

describe("organization RBAC", () => {
  it("limits project and organization management to owners and admins", () => {
    expect(canManageProject("OWNER")).toBe(true);
    expect(canManageProject("ADMIN")).toBe(true);
    expect(canManageProject("MEMBER")).toBe(false);
    expect(canManageOrganization("VIEWER")).toBe(false);
  });

  it("never permits owner mutation through ordinary member controls", () => {
    expect(canManageRole("OWNER", "OWNER", "ADMIN")).toBe(false);
    expect(canManageRole("OWNER", "ADMIN", "OWNER")).toBe(false);
    expect(canManageRole("ADMIN", "OWNER", "MEMBER")).toBe(false);
  });

  it("allows owners to manage non-owner roles", () => {
    expect(canManageRole("OWNER", "ADMIN", "MEMBER")).toBe(true);
    expect(canManageRole("OWNER", "MEMBER", "VIEWER")).toBe(true);
  });

  it("prevents admins from managing or assigning admins", () => {
    expect(canManageRole("ADMIN", "ADMIN", "MEMBER")).toBe(false);
    expect(canManageRole("ADMIN", "MEMBER", "ADMIN")).toBe(false);
    expect(canManageRole("ADMIN", "MEMBER", "VIEWER")).toBe(true);
  });

  it("applies the same hierarchy to invitations", () => {
    expect(canInviteRole("OWNER", "ADMIN")).toBe(true);
    expect(canInviteRole("OWNER", "OWNER")).toBe(false);
    expect(canInviteRole("ADMIN", "ADMIN")).toBe(false);
    expect(canInviteRole("ADMIN", "MEMBER")).toBe(true);
    expect(canInviteRole("MEMBER", "VIEWER")).toBe(false);
  });
});
