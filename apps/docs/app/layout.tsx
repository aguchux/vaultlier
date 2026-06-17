import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { ThemeProvider } from "@vaultlier/ui/theme-provider";
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

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Vaultlier Documentation",
  url: "https://docs.vaultlier.com",
  description:
    "Technical documentation for the Vaultlier CLI, runtime SDK, projects, environments, API keys, and security model.",
  publisher: {
    "@type": "Organization",
    name: "Vaultlier",
    url: "https://vaultlier.com",
    logo: "https://vaultlier.com/icons/icon-512.png",
  },
};

export const metadata: Metadata = {
  metadataBase: new URL("https://docs.vaultlier.com"),
  applicationName: "Vaultlier Docs",
  title: {
    default: "Vaultlier Docs",
    template: "%s | Vaultlier Docs",
  },
  description:
    "Learn to manage typed application configuration with Vaultlier without writing secret values to disk.",
  keywords: [
    "Vaultlier documentation",
    "Vaultlier CLI",
    "Vaultlier SDK",
    "secret management",
    "typed configuration",
    "environment variables",
  ],
  authors: [{ name: "Vaultlier", url: "https://vaultlier.com" }],
  creator: "Vaultlier",
  publisher: "Vaultlier",
  category: "Developer Documentation",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    siteName: "Vaultlier Docs",
    title: "Vaultlier Documentation",
    description:
      "Learn to manage typed application configuration with Vaultlier without writing secret values to disk.",
    images: [
      {
        url: "/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: "Vaultlier Documentation",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Vaultlier Documentation",
    description:
      "Learn to manage typed application configuration with Vaultlier without writing secret values to disk.",
    images: ["/opengraph-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  formatDetection: {
    address: false,
    email: false,
    telephone: false,
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Vaultlier Docs",
  },
};

export const viewport: Viewport = {
  themeColor: "#059669",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): React.JSX.Element {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <ThemeProvider>
          <DocsShell>{children}</DocsShell>
        </ThemeProvider>
      </body>
    </html>
  );
}
