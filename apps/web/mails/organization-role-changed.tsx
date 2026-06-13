import React from "react";
import { Text } from "react-email";
import { EmailLayout, emailText } from "./components/email-layout";

export interface OrganizationRoleChangedEmailProps {
  name?: string | null;
  organizationName: string;
  previousRole: string;
  nextRole: string;
  dashboardUrl: string;
}

export function OrganizationRoleChangedEmail({
  name,
  organizationName,
  previousRole,
  nextRole,
  dashboardUrl,
}: OrganizationRoleChangedEmailProps) {
  return (
    <EmailLayout
      preview={`Your role in ${organizationName} changed`}
      heading="Organization role updated"
      actionHref={dashboardUrl}
      actionLabel="Review access"
    >
      <Text style={emailText.body}>
        {name ? `${name}, your` : "Your"} access in {organizationName} changed
        from {previousRole} to {nextRole}.
      </Text>
      <Text style={emailText.muted}>
        This may change which projects, environments, and organization actions
        you can access.
      </Text>
    </EmailLayout>
  );
}

OrganizationRoleChangedEmail.PreviewProps = {
  name: "Jamie Lee",
  organizationName: "Acme Corporation",
  previousRole: "Viewer",
  nextRole: "Member",
  dashboardUrl: "http://localhost:3000/dashboard",
} satisfies OrganizationRoleChangedEmailProps;

export default OrganizationRoleChangedEmail;
