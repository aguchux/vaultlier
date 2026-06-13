import React from "react";
import { Text } from "react-email";
import { EmailLayout, emailText } from "./components/email-layout";

export interface ApiKeyRevokedEmailProps {
  projectName: string;
  keyName: string;
  keyPrefix: string;
  settingsUrl: string;
}

export function ApiKeyRevokedEmail({
  projectName,
  keyName,
  keyPrefix,
  settingsUrl,
}: ApiKeyRevokedEmailProps) {
  return (
    <EmailLayout
      preview={`An API key was revoked for ${projectName}`}
      heading="API key revoked"
      actionHref={settingsUrl}
      actionLabel="Review API keys"
    >
      <Text style={emailText.body}>
        The following project-scoped API key has been revoked and can no longer
        authenticate Vaultlier requests.
      </Text>
      <Text style={emailText.detail}>
        Project: {projectName}
        <br />
        Key: {keyName}
        <br />
        Prefix: {keyPrefix}
      </Text>
    </EmailLayout>
  );
}

ApiKeyRevokedEmail.PreviewProps = {
  projectName: "Payments API",
  keyName: "Production runtime",
  keyPrefix: "vlt_live_a1b2",
  settingsUrl: "http://localhost:3000/dashboard/project/settings",
} satisfies ApiKeyRevokedEmailProps;

export default ApiKeyRevokedEmail;
