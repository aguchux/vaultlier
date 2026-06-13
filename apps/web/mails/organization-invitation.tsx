import React from "react";
import { Text } from "react-email";
import { EmailLayout, emailText } from "./components/email-layout";

export interface OrganizationInvitationEmailProps {
  organizationName: string;
  inviterName: string;
  role: string;
  expiresAt: string;
  acceptUrl: string;
}

export function OrganizationInvitationEmail({
  organizationName,
  inviterName,
  role,
  expiresAt,
  acceptUrl,
}: OrganizationInvitationEmailProps) {
  return (
    <EmailLayout
      preview={`${inviterName} invited you to ${organizationName}`}
      heading={`Join ${organizationName}`}
      actionHref={acceptUrl}
      actionLabel="Accept invitation"
    >
      <Text style={emailText.body}>
        {inviterName} invited you to collaborate in Vaultlier with the {role}{" "}
        role.
      </Text>
      <Text style={emailText.detail}>
        Organization: {organizationName}
        <br />
        Role: {role}
        <br />
        Invitation expires: {expiresAt}
      </Text>
      <Text style={emailText.muted}>
        Sign in using this email address. Vaultlier will apply the invitation
        when authentication completes.
      </Text>
    </EmailLayout>
  );
}

OrganizationInvitationEmail.PreviewProps = {
  organizationName: "Acme Corporation",
  inviterName: "Alex Kim",
  role: "Member",
  expiresAt: "June 27, 2026",
  acceptUrl: "http://localhost:3000/login",
} satisfies OrganizationInvitationEmailProps;

export default OrganizationInvitationEmail;
