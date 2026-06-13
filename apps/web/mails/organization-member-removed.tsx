import React from "react";
import { Text } from "react-email";
import { EmailLayout, emailText } from "./components/email-layout";

export interface OrganizationMemberRemovedEmailProps {
  name?: string | null;
  organizationName: string;
}

export function OrganizationMemberRemovedEmail({
  name,
  organizationName,
}: OrganizationMemberRemovedEmailProps) {
  return (
    <EmailLayout
      preview={`Your access to ${organizationName} was removed`}
      heading="Organization access removed"
    >
      <Text style={emailText.body}>
        {name ? `${name}, your` : "Your"} membership in {organizationName} has
        been removed. You can no longer access its projects, environments, or
        audit data.
      </Text>
      <Text style={emailText.muted}>
        Contact an organization owner if you believe this change was made in
        error.
      </Text>
    </EmailLayout>
  );
}

OrganizationMemberRemovedEmail.PreviewProps = {
  name: "Jamie Lee",
  organizationName: "Acme Corporation",
} satisfies OrganizationMemberRemovedEmailProps;

export default OrganizationMemberRemovedEmail;
