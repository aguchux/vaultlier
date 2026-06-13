import React from "react";
import { Text } from "react-email";
import { afterEach, describe, expect, it, vi } from "vitest";
import { sendVaultlierEmail, vaultlierUrl } from "./email";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("email delivery", () => {
  it("skips delivery without a Resend key outside production", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("RESEND_API_KEY", "");

    await expect(
      sendVaultlierEmail({
        to: "alex@example.com",
        subject: "Test",
        template: "test",
        react: <Text>Test email</Text>,
      }),
    ).resolves.toEqual({ id: null, skipped: true });
  });

  it("requires a Resend key in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("RESEND_API_KEY", "");

    await expect(
      sendVaultlierEmail({
        to: "alex@example.com",
        subject: "Test",
        template: "test",
        react: <Text>Test email</Text>,
      }),
    ).rejects.toThrow("RESEND_API_KEY is required in production");
  });

  it("builds application links from the configured public URL", () => {
    vi.stubEnv("VAULTLIER_APP_URL", "https://app.vaultlier.com/");
    expect(vaultlierUrl("dashboard")).toBe(
      "https://app.vaultlier.com/dashboard",
    );
  });
});
