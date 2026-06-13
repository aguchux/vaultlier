import React, { type ReactNode } from "react";
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from "react-email";

interface EmailLayoutProps {
  preview: string;
  heading: string;
  children: ReactNode;
  actionHref?: string;
  actionLabel?: string;
}

export function EmailLayout({
  preview,
  heading,
  children,
  actionHref,
  actionLabel,
}: EmailLayoutProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Section style={styles.brandRow}>
            <Img
              src="https://vaultlier.com/brand/logo.png"
              width="36"
              height="36"
              alt=""
              style={styles.brandMark}
            />
            <Text style={styles.brand}>Vaultlier</Text>
          </Section>
          <Heading style={styles.heading}>{heading}</Heading>
          <Section style={styles.content}>{children}</Section>
          {actionHref && actionLabel ? (
            <Section style={styles.actionRow}>
              <Button href={actionHref} style={styles.button}>
                {actionLabel}
              </Button>
            </Section>
          ) : null}
          <Hr style={styles.divider} />
          <Text style={styles.footer}>
            Vaultlier keeps application configuration sealed, typed, and
            auditable. Questions? Contact{" "}
            <Link href="mailto:support@vaultlier.com" style={styles.link}>
              support@vaultlier.com
            </Link>
            .
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export const emailText = {
  body: {
    color: "#334155",
    fontSize: "15px",
    lineHeight: "24px",
    margin: "0 0 16px",
  },
  detail: {
    backgroundColor: "#f1f5f9",
    borderRadius: "8px",
    color: "#0f172a",
    fontSize: "14px",
    lineHeight: "22px",
    margin: "20px 0",
    padding: "14px 16px",
  },
  muted: {
    color: "#64748b",
    fontSize: "13px",
    lineHeight: "20px",
    margin: "16px 0 0",
  },
} as const;

const styles = {
  body: {
    backgroundColor: "#f8fafc",
    fontFamily:
      "Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
    margin: 0,
    padding: "36px 12px",
  },
  container: {
    backgroundColor: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: "14px",
    boxShadow: "0 8px 24px rgba(15, 23, 42, 0.05)",
    margin: "0 auto",
    maxWidth: "560px",
    padding: "32px",
  },
  brandRow: { marginBottom: "28px" },
  brandMark: {
    display: "inline-block",
    height: "36px",
    margin: "0 10px 0 0",
    objectFit: "contain" as const,
    verticalAlign: "middle",
    width: "36px",
  },
  brand: {
    color: "#0f172a",
    display: "inline-block",
    fontSize: "20px",
    fontWeight: "700",
    margin: 0,
    verticalAlign: "middle",
  },
  heading: {
    color: "#0f172a",
    fontSize: "26px",
    fontWeight: "700",
    lineHeight: "34px",
    margin: "0 0 20px",
  },
  content: { margin: 0 },
  actionRow: { margin: "26px 0 8px" },
  button: {
    backgroundColor: "#059669",
    borderRadius: "8px",
    color: "#ffffff",
    display: "inline-block",
    fontSize: "14px",
    fontWeight: "600",
    padding: "12px 20px",
    textDecoration: "none",
  },
  divider: { borderColor: "#e2e8f0", margin: "30px 0 20px" },
  footer: {
    color: "#64748b",
    fontSize: "12px",
    lineHeight: "19px",
    margin: 0,
  },
  link: { color: "#047857", textDecoration: "underline" },
} as const;
