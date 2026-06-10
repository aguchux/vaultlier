import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Vaultlier Schema",
  description:
    "JSON Schema for the Vaultlier config file (vaultlier.json / vaultlier.config.json).",
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          maxWidth: "48rem",
          margin: "0 auto",
          padding: "2rem 1.25rem",
          lineHeight: 1.6,
          color: "#1a1a1a",
        }}
      >
        {children}
      </body>
    </html>
  );
}
