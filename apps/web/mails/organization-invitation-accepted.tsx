import React from "react";
import { Text } from "react-email";
import { EmailLayout, emailText } from "./components/email-layout";

export interface OrganizationInvitationAcceptedEmailProps {
  memberName: string;
  memberEmail: string;
  organizationName: string;
  role: string;
  membersUrl: string;
}

export function OrganizationInvitationAcceptedEmail({
  memberName,
  memberEmail,
  organizationName,
  role,
  membersUrl,
}: OrganizationInvitationAcceptedEmailProps) {
  return (
    <EmailLayout
      preview={`${memberName} accepted your invitation`}
      heading="Invitation accepted"
      actionHref={membersUrl}
      actionLabel="Manage members"
    >
      <Text style={emailText.body}>
        {memberName} ({memberEmail}) accepted the invitation to{" "}
        {organizationName} as a {role}.
      </Text>
    </EmailLayout>
  );
}

OrganizationInvitationAcceptedEmail.PreviewProps = {
  memberName: "Jamie Lee",
  memberEmail: "jamie@example.com",
  organizationName: "Acme Corporation",
  role: "Member",
  membersUrl: "http://localhost:3000/dashboard/organizations",
} satisfies OrganizationInvitationAcceptedEmailProps;

export default OrganizationInvitationAcceptedEmail;
