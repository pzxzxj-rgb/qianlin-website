import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["/", "/privacy", "/terms", "/refund"].map((path) => ({ url: `${siteUrl}${path}`, lastModified: new Date() }));
}
