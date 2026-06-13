import React, { type ReactElement } from "react";
import { render } from "react-email";
import { describe, expect, it } from "vitest";
import {
  ApiKeyCreatedEmail,
  ApiKeyRevokedEmail,
  OrganizationInvitationAcceptedEmail,
  OrganizationInvitationEmail,
  OrganizationInvitationRevokedEmail,
  OrganizationMemberAddedEmail,
  OrganizationMemberRemovedEmail,
  OrganizationRoleChangedEmail,
  WelcomeEmail,
} from ".";

const dashboardUrl = "https://vaultlier.com/dashboard";

const templates: Array<{ name: string; email: ReactElement }> = [
  {
    name: "welcome",
    email: <WelcomeEmail name="Alex" dashboardUrl={dashboardUrl} />,
  },
  {
    name: "organization invitation",
    email: (
      <OrganizationInvitationEmail
        organizationName="Acme"
        inviterName="Alex"
        role="Member"
        expiresAt="June 27, 2026"
        acceptUrl="https://vaultlier.com/login"
      />
    ),
  },
  {
    name: "organization invitation accepted",
    email: (
      <OrganizationInvitationAcceptedEmail
        memberName="Jamie"
        memberEmail="jamie@example.com"
        organizationName="Acme"
        role="Member"
        membersUrl={dashboardUrl}
      />
    ),
  },
  {
    name: "organization invitation revoked",
    email: <OrganizationInvitationRevokedEmail organizationName="Acme" />,
  },
  {
    name: "organization member added",
    email: (
      <OrganizationMemberAddedEmail
        name="Jamie"
        organizationName="Acme"
        role="Member"
        dashboardUrl={dashboardUrl}
      />
    ),
  },
  {
    name: "organization member removed",
    email: (
      <OrganizationMemberRemovedEmail name="Jamie" organizationName="Acme" />
    ),
  },
  {
    name: "organization role changed",
    email: (
      <OrganizationRoleChangedEmail
        name="Jamie"
        organizationName="Acme"
        previousRole="Viewer"
        nextRole="Member"
        dashboardUrl={dashboardUrl}
      />
    ),
  },
  {
    name: "API key created",
    email: (
      <ApiKeyCreatedEmail
        projectName="Payments"
        keyName="Production runtime"
        keyPrefix="vlt_live_a1b2"
        role="Viewer"
        settingsUrl={dashboardUrl}
      />
    ),
  },
  {
    name: "API key revoked",
    email: (
      <ApiKeyRevokedEmail
        projectName="Payments"
        keyName="Production runtime"
        keyPrefix="vlt_live_a1b2"
        settingsUrl={dashboardUrl}
      />
    ),
  },
];

describe("Vaultlier email templates", () => {
  it.each(templates)("renders the $name template", async ({ email }) => {
    const html = await render(email);
    const text = await render(email, { plainText: true });

    expect(html).toContain("Vaultlier");
    expect(html).toContain("<!DOCTYPE html");
    expect(text).toContain("Vaultlier");
  });

  it("never includes a raw API key", async () => {
    const rawKey = "vlt_live_do_not_send_this_raw_key";
    const html = await render(
      <ApiKeyCreatedEmail
        projectName="Payments"
        keyName="Production runtime"
        keyPrefix={rawKey.slice(0, 13)}
        role="Viewer"
        settingsUrl={dashboardUrl}
      />,
    );

    expect(html).not.toContain(rawKey);
    expect(html).toContain(rawKey.slice(0, 13));
  });
});
