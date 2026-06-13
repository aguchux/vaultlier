import React from "react";
import { Text } from "react-email";
import { EmailLayout, emailText } from "./components/email-layout";

export interface OrganizationMemberAddedEmailProps {
  name?: string | null;
  organizationName: string;
  role: string;
  dashboardUrl: string;
}

export function OrganizationMemberAddedEmail({
  name,
  organizationName,
  role,
  dashboardUrl,
}: OrganizationMemberAddedEmailProps) {
  return (
    <EmailLayout
      preview={`You now have access to ${organizationName}`}
      heading={`You joined ${organizationName}`}
      actionHref={dashboardUrl}
      actionLabel="Open organization"
    >
      <Text style={emailText.body}>
        {name ? `${name}, you` : "You"} now have {role} access to the{" "}
        {organizationName} organization in Vaultlier.
      </Text>
      <Text style={emailText.muted}>
        Your role controls which projects, environments, and administrative
        actions are available to you.
      </Text>
    </EmailLayout>
  );
}

OrganizationMemberAddedEmail.PreviewProps = {
  name: "Jamie Lee",
  organizationName: "Acme Corporation",
  role: "Member",
  dashboardUrl: "http://localhost:3000/dashboard",
} satisfies OrganizationMemberAddedEmailProps;

export default OrganizationMemberAddedEmail;
