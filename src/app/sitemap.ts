import type { MetadataRoute } from "next";
import { SITE, TOOLS } from "@/config/tools";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ["", "privacy", ...TOOLS.map((t) => t.slug)];
  return pages.map((p) => ({ url: `${SITE.url}/${p}`.replace(/\/$/, "") || SITE.url, changeFrequency: "monthly" }));
}
