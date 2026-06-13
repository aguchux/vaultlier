import React from "react";
import { Text } from "react-email";
import { EmailLayout, emailText } from "./components/email-layout";

export interface ApiKeyCreatedEmailProps {
  projectName: string;
  keyName: string;
  keyPrefix: string;
  role: string;
  settingsUrl: string;
}

export function ApiKeyCreatedEmail({
  projectName,
  keyName,
  keyPrefix,
  role,
  settingsUrl,
}: ApiKeyCreatedEmailProps) {
  return (
    <EmailLayout
      preview={`A new API key was created for ${projectName}`}
      heading="API key created"
      actionHref={settingsUrl}
      actionLabel="Review API keys"
    >
      <Text style={emailText.body}>
        A project-scoped API key was created. Vaultlier will never send or
        display the full key in an email.
      </Text>
      <Text style={emailText.detail}>
        Project: {projectName}
        <br />
        Key: {keyName}
        <br />
        Prefix: {keyPrefix}
        <br />
        Role: {role}
      </Text>
      <Text style={emailText.muted}>
        Revoke the key immediately if you did not authorize this action.
      </Text>
    </EmailLayout>
  );
}

ApiKeyCreatedEmail.PreviewProps = {
  projectName: "Payments API",
  keyName: "Production runtime",
  keyPrefix: "vlt_live_a1b2",
  role: "Viewer",
  settingsUrl: "http://localhost:3000/dashboard/project/settings",
} satisfies ApiKeyCreatedEmailProps;

export default ApiKeyCreatedEmail;
