import React from "react";
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
} from "../mails";
import { sendVaultlierEmailSafely, vaultlierUrl } from "./email";

function displayRole(role: string): string {
  return role.charAt(0) + role.slice(1).toLowerCase();
}

export async function sendWelcomeEmail(input: {
  to: string;
  name?: string | null;
}): Promise<void> {
  await sendVaultlierEmailSafely({
    to: input.to,
    subject: "Welcome to Vaultlier",
    template: "welcome",
    react: <WelcomeEmail name={input.name} dashboardUrl={vaultlierUrl()} />,
  });
}

export async function sendOrganizationInvitationEmail(input: {
  to: string;
  organizationName: string;
  inviterName: string;
  role: string;
  expiresAt: Date;
}): Promise<void> {
  await sendVaultlierEmailSafely({
    to: input.to,
    subject: `You were invited to ${input.organizationName}`,
    template: "organization-invitation",
    react: (
      <OrganizationInvitationEmail
        organizationName={input.organizationName}
        inviterName={input.inviterName}
        role={displayRole(input.role)}
        expiresAt={input.expiresAt.toLocaleDateString("en", {
          dateStyle: "long",
          timeZone: "UTC",
        })}
        acceptUrl={vaultlierUrl("/login")}
      />
    ),
  });
}

export async function sendOrganizationMemberAddedEmail(input: {
  to: string;
  name?: string | null;
  organizationName: string;
  organizationId: string;
  role: string;
}): Promise<void> {
  await sendVaultlierEmailSafely({
    to: input.to,
    subject: `You now have access to ${input.organizationName}`,
    template: "organization-member-added",
    react: (
      <OrganizationMemberAddedEmail
        name={input.name}
        organizationName={input.organizationName}
        role={displayRole(input.role)}
        dashboardUrl={vaultlierUrl(
          `/dashboard?organizationId=${encodeURIComponent(input.organizationId)}`,
        )}
      />
    ),
  });
}

export async function sendOrganizationInvitationAcceptedEmail(input: {
  to: string;
  memberName: string;
  memberEmail: string;
  organizationName: string;
  role: string;
}): Promise<void> {
  await sendVaultlierEmailSafely({
    to: input.to,
    subject: `${input.memberName} joined ${input.organizationName}`,
    template: "organization-invitation-accepted",
    react: (
      <OrganizationInvitationAcceptedEmail
        memberName={input.memberName}
        memberEmail={input.memberEmail}
        organizationName={input.organizationName}
        role={displayRole(input.role)}
        membersUrl={vaultlierUrl("/dashboard/organizations")}
      />
    ),
  });
}

export async function sendOrganizationRoleChangedEmail(input: {
  to: string;
  name?: string | null;
  organizationName: string;
  previousRole: string;
  nextRole: string;
}): Promise<void> {
  await sendVaultlierEmailSafely({
    to: input.to,
    subject: `Your role in ${input.organizationName} changed`,
    template: "organization-role-changed",
    react: (
      <OrganizationRoleChangedEmail
        name={input.name}
        organizationName={input.organizationName}
        previousRole={displayRole(input.previousRole)}
        nextRole={displayRole(input.nextRole)}
        dashboardUrl={vaultlierUrl()}
      />
    ),
  });
}

export async function sendOrganizationMemberRemovedEmail(input: {
  to: string;
  name?: string | null;
  organizationName: string;
}): Promise<void> {
  await sendVaultlierEmailSafely({
    to: input.to,
    subject: `Your access to ${input.organizationName} was removed`,
    template: "organization-member-removed",
    react: (
      <OrganizationMemberRemovedEmail
        name={input.name}
        organizationName={input.organizationName}
      />
    ),
  });
}

export async function sendOrganizationInvitationRevokedEmail(input: {
  to: string;
  organizationName: string;
}): Promise<void> {
  await sendVaultlierEmailSafely({
    to: input.to,
    subject: `Your invitation to ${input.organizationName} was withdrawn`,
    template: "organization-invitation-revoked",
    react: (
      <OrganizationInvitationRevokedEmail
        organizationName={input.organizationName}
      />
    ),
  });
}

export async function sendApiKeyCreatedEmail(input: {
  to: string;
  projectId: string;
  projectName: string;
  keyName: string;
  keyPrefix: string;
  role: string;
}): Promise<void> {
  await sendVaultlierEmailSafely({
    to: input.to,
    subject: `API key created for ${input.projectName}`,
    template: "api-key-created",
    react: (
      <ApiKeyCreatedEmail
        projectName={input.projectName}
        keyName={input.keyName}
        keyPrefix={input.keyPrefix}
        role={displayRole(input.role)}
        settingsUrl={vaultlierUrl(`/dashboard/${input.projectId}/settings`)}
      />
    ),
  });
}

export async function sendApiKeyRevokedEmail(input: {
  to: string;
  projectId: string;
  projectName: string;
  keyName: string;
  keyPrefix: string;
}): Promise<void> {
  await sendVaultlierEmailSafely({
    to: input.to,
    subject: `API key revoked for ${input.projectName}`,
    template: "api-key-revoked",
    react: (
      <ApiKeyRevokedEmail
        projectName={input.projectName}
        keyName={input.keyName}
        keyPrefix={input.keyPrefix}
        settingsUrl={vaultlierUrl(`/dashboard/${input.projectId}/settings`)}
      />
    ),
  });
}
