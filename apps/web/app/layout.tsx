import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { ThemeProvider } from "@vaultlier/ui/theme-provider";
import "./globals.css";

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
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://vaultlier.com/#organization",
      name: "Vaultlier",
      url: "https://vaultlier.com",
      logo: "https://vaultlier.com/icons/icon-512.png",
    },
    {
      "@type": "SoftwareApplication",
      name: "Vaultlier",
      url: "https://vaultlier.com",
      applicationCategory: "DeveloperApplication",
      operatingSystem: "Cross-platform",
      description:
        "Typed application configuration in a sealed, auditable vault without writing secret values to local disk.",
      publisher: {
        "@id": "https://vaultlier.com/#organization",
      },
    },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL("https://vaultlier.com"),
  applicationName: "Vaultlier",
  title: {
    default: "Vaultlier - Configuration secrets, secured",
    template: "%s | Vaultlier",
  },
  description:
    "Manage typed application configuration in a sealed, auditable vault without writing secret values to local disk.",
  keywords: [
    "secret management",
    "environment variables",
    "configuration management",
    "developer security",
    "TypeScript SDK",
    "secrets vault",
  ],
  authors: [{ name: "Vaultlier", url: "https://vaultlier.com" }],
  creator: "Vaultlier",
  publisher: "Vaultlier",
  category: "Developer Tools",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    siteName: "Vaultlier",
    title: "Vaultlier - Configuration secrets, secured",
    description:
      "Manage typed application configuration in a sealed, auditable vault without writing secret values to local disk.",
    images: [
      {
        url: "/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: "Vaultlier - Configuration secrets, secured",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Vaultlier - Configuration secrets, secured",
    description:
      "Manage typed application configuration in a sealed, auditable vault without writing secret values to local disk.",
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
    title: "Vaultlier",
  },
};

export const viewport: Viewport = {
  themeColor: "#059669",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
