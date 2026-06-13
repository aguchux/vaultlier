import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/v1/"],
    },
    sitemap: "https://vaultlier.com/sitemap.xml",
    host: "https://vaultlier.com",
  };
}
