import type { Metadata } from "next";

const siteName = "Vaultlier Docs";
const socialImage = {
  url: "/opengraph-image.png",
  width: 1200,
  height: 630,
  alt: "Vaultlier Documentation",
};

type DocsMetadataOptions = {
  title: string;
  description: string;
  path: `/${string}` | "/";
};

export function createDocsMetadata({
  title,
  description,
  path,
}: DocsMetadataOptions): Metadata {
  const socialTitle = `${title} | ${siteName}`;

  return {
    title,
    description,
    alternates: {
      canonical: path,
    },
    openGraph: {
      type: "website",
      locale: "en_US",
      url: path,
      siteName,
      title: socialTitle,
      description,
      images: [socialImage],
    },
    twitter: {
      card: "summary_large_image",
      title: socialTitle,
      description,
      images: [socialImage.url],
    },
  };
}
