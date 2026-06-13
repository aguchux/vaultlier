import type { MetadataRoute } from "next";
import { flatNav } from "./lib/nav";

const baseUrl = "https://docs.vaultlier.com";

export default function sitemap(): MetadataRoute.Sitemap {
  return flatNav.map(({ href }) => ({
    url: href === "/" ? baseUrl : `${baseUrl}${href}`,
    changeFrequency: href === "/" ? "weekly" : "monthly",
    priority: href === "/" ? 1 : 0.8,
  }));
}
