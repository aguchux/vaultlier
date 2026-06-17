import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://vaultlier.com";
  return [
    { url: base, changeFrequency: "monthly", priority: 1 },
    { url: `${base}/product`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/security`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/contribute`, changeFrequency: "monthly", priority: 0.6 },
  ];
}
