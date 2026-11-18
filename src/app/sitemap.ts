import type { MetadataRoute } from "next";
import { SITE } from "@/config/site";
import { TOOLS } from "@/config/tools";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ["", "privacy", "terms", ...TOOLS.map((t) => t.slug)];
  return pages.map((p) => ({ url: `${SITE.url}/${p}`.replace(/\/$/, "") || SITE.url, changeFrequency: "monthly" }));
}
