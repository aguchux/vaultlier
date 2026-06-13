import React from "react";
import { Text } from "react-email";
import { EmailLayout, emailText } from "./components/email-layout";

export interface OrganizationInvitationRevokedEmailProps {
  organizationName: string;
}

export function OrganizationInvitationRevokedEmail({
  organizationName,
}: OrganizationInvitationRevokedEmailProps) {
  return (
    <EmailLayout
      preview={`Your invitation to ${organizationName} was withdrawn`}
      heading="Invitation withdrawn"
    >
      <Text style={emailText.body}>
        The pending invitation to join {organizationName} in Vaultlier has been
        withdrawn and can no longer be accepted.
      </Text>
      <Text style={emailText.muted}>
        Contact an organization owner if you still need access.
      </Text>
    </EmailLayout>
  );
}

OrganizationInvitationRevokedEmail.PreviewProps = {
  organizationName: "Acme Corporation",
} satisfies OrganizationInvitationRevokedEmailProps;

export default OrganizationInvitationRevokedEmail;
