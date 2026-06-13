import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  metadataBase: new URL("https://schema.vaultlier.com"),
  applicationName: "Vaultlier Schema",
  title: "Vaultlier Schema",
  description:
    "JSON Schema for the Vaultlier config file (vaultlier.json / vaultlier.config.json).",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Vaultlier Schema",
  },
};

export const viewport: Viewport = {
  themeColor: "#059669",
};

// This is a small static reference page with no app chrome to host a toggle,
// so it follows the OS theme via `color-scheme` and light-dark() rather than
// pulling in the full next-themes provider.
const themeCss = `
  :root { color-scheme: light dark; }
  body {
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    max-width: 48rem;
    margin: 0 auto;
    padding: 2rem 1.25rem;
    line-height: 1.6;
    background: light-dark(#ffffff, #0b0f0c);
    color: light-dark(#1a1a1a, #e8ecea);
  }
  a { color: light-dark(#16794c, #32d583); }
`;

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  return (
    <html lang="en">
      <head>
        <style>{themeCss}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
