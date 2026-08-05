import type { MetadataRoute } from "next";
import { and, eq } from "drizzle-orm";
import { getDb } from "../db";
import { tenants } from "../db/schema";
import { DEFAULT_TENANT_SLUG } from "../lib/tenancy/resolveTenant";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const legalPaths = ["/privacy", "/terms", "/refund"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const lastModified = new Date();
  try {
    const db = await getDb();
    const rows = await db.select({ slug: tenants.slug }).from(tenants).where(and(eq(tenants.status, "active"), eq(tenants.siteStatus, "published"), eq(tenants.isDemo, false)));
    const tenantPaths = rows.map((row) => row.slug === DEFAULT_TENANT_SLUG ? "/" : `/t/${row.slug}`);
    return [...new Set([...tenantPaths, ...legalPaths])].map((path) => ({ url: `${siteUrl}${path}`, lastModified }));
  } catch {
    return ["/", ...legalPaths].map((path) => ({ url: `${siteUrl}${path}`, lastModified }));
  }
}
