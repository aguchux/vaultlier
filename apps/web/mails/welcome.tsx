import React from "react";
import { Text } from "react-email";
import { EmailLayout, emailText } from "./components/email-layout";

export interface WelcomeEmailProps {
  name?: string | null;
  dashboardUrl: string;
}

export function WelcomeEmail({ name, dashboardUrl }: WelcomeEmailProps) {
  const greeting = name ? `Welcome, ${name}.` : "Welcome to Vaultlier.";
  return (
    <EmailLayout
      preview="Your Vaultlier workspace is ready"
      heading={greeting}
      actionHref={dashboardUrl}
      actionLabel="Open your dashboard"
    >
      <Text style={emailText.body}>
        Your account is ready. Create a project, define its environments, and
        connect your application without writing decrypted secrets to disk.
      </Text>
      <Text style={emailText.body}>
        Vaultlier keeps project configuration centrally managed and records
        access in the audit log.
      </Text>
    </EmailLayout>
  );
}

WelcomeEmail.PreviewProps = {
  name: "Alex Kim",
  dashboardUrl: "http://localhost:3000/dashboard",
} satisfies WelcomeEmailProps;

export default WelcomeEmail;
