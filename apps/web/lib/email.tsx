import type { ReactElement } from "react";
import { Resend } from "resend";
import { render } from "react-email";

interface SendVaultlierEmailInput {
  to: string;
  subject: string;
  react: ReactElement;
  template: string;
}

export interface EmailDeliveryResult {
  id: string | null;
  skipped: boolean;
}

let resendClient: Resend | null = null;
let resendClientKey: string | null = null;

function getResend(apiKey: string): Resend {
  if (!resendClient || resendClientKey !== apiKey) {
    resendClient = new Resend(apiKey);
    resendClientKey = apiKey;
  }
  return resendClient;
}

function getFromAddress(): string {
  const configured = process.env.RESEND_FROM_EMAIL?.trim();
  if (configured) return configured;
  if (process.env.NODE_ENV === "production") {
    throw new Error("RESEND_FROM_EMAIL is required in production.");
  }
  return "Vaultlier <onboarding@resend.dev>";
}

export function vaultlierUrl(path = "/dashboard"): string {
  const baseUrl =
    process.env.VAULTLIER_APP_URL?.trim() ||
    process.env.AUTH_URL?.trim() ||
    "http://localhost:3000";
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${baseUrl.replace(/\/$/, "")}${normalizedPath}`;
}

export async function sendVaultlierEmail(
  input: SendVaultlierEmailInput,
): Promise<EmailDeliveryResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("RESEND_API_KEY is required in production.");
    }
    return { id: null, skipped: true };
  }

  const [html, text] = await Promise.all([
    render(input.react),
    render(input.react, { plainText: true }),
  ]);
  const { data, error } = await getResend(apiKey).emails.send({
    from: getFromAddress(),
    to: input.to,
    subject: input.subject,
    html,
    text,
    tags: [{ name: "template", value: input.template }],
  });

  if (error) {
    throw new Error(`Resend delivery failed: ${error.name}`);
  }
  return { id: data?.id ?? null, skipped: false };
}

export async function sendVaultlierEmailSafely(
  input: SendVaultlierEmailInput,
): Promise<EmailDeliveryResult> {
  try {
    return await sendVaultlierEmail(input);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`[email:${input.template}] ${message}`);
    return { id: null, skipped: true };
  }
}
