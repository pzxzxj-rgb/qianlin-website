import type { MetadataRoute } from "next";
import { and, eq, ne } from "drizzle-orm";
import { getDb } from "../db";
import { tenantSiteProfiles, tenants } from "../db/schema";
import { DEFAULT_TENANT_SLUG } from "../lib/tenancy/resolveTenant";
import { getSiteUrl } from "../lib/siteUrl";

const legalPaths = ["/privacy", "/terms", "/refund"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const lastModified = new Date();
  const siteUrl = await getSiteUrl();

  try {
    const db = await getDb();
    const rows = await db
      .select({ slug: tenants.slug })
      .from(tenants)
      .innerJoin(
        tenantSiteProfiles,
        eq(tenantSiteProfiles.tenantId, tenants.id),
      )
      .where(
        and(
          eq(tenants.status, "active"),
          eq(tenants.siteStatus, "published"),
          eq(tenants.isDemo, false),
          eq(tenantSiteProfiles.status, "published"),
          ne(tenantSiteProfiles.companyNameZh, ""),
          ne(tenantSiteProfiles.companyNameEn, ""),
        ),
      );

    const paths = rows.flatMap((row) => {
      const basePath =
        row.slug === DEFAULT_TENANT_SLUG
          ? ""
          : `/t/${row.slug}`;

      return [
        basePath || "/",
        ...legalPaths.map((path) => `${basePath}${path}`),
      ];
    });

    return [...new Set(paths)].map((path) => ({
      url: `${siteUrl}${path}`,
      lastModified,
    }));
  } catch {
    return [];
  }
}
