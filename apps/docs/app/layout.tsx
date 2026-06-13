import type { Metadata } from "next";
import localFont from "next/font/local";
import { ThemeProvider } from "@repo/ui/theme-provider";
import "./globals.css";
import { DocsShell } from "./components/docs-shell";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://docs.vaultlier.com"),
  title: {
    default: "Vaultlier Docs",
    template: "%s — Vaultlier Docs",
  },
  description:
    "Documentation for Vaultlier — a sealed configuration vault that replaces the .env workflow without writing secret values to disk.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): React.JSX.Element {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <ThemeProvider>
          <DocsShell>{children}</DocsShell>
        </ThemeProvider>
      </body>
    </html>
  );
}
