import type { Metadata } from "next";
import { TenantHomeClient } from "../components/TenantHomeClient";
import { DEFAULT_TENANT_SLUG, getDefaultTenant, getTenantSiteConfig } from "../lib/tenancy/resolveTenant";
import { getSiteUrl } from "../lib/siteUrl";
import type { TenantSiteConfig } from "../lib/tenancy/types";

export async function generateMetadata(): Promise<Metadata> {
  try {
    const tenant = await getDefaultTenant();
    if (tenant) {
      const siteConfig = await getTenantSiteConfig(tenant);
      const isPublic = siteConfig.isConfigured && siteConfig.tenant.siteStatus === "published";
      const siteUrl = getSiteUrl();
      return { title: siteConfig.profile.companyName.zh, description: siteConfig.profile.description.zh || siteConfig.profile.primaryRegion.zh, alternates: { canonical: siteUrl }, robots: isPublic && !siteConfig.tenant.isDemo ? undefined : { index: false, follow: false }, openGraph: { title: siteConfig.profile.companyName.en, description: siteConfig.profile.description.en, url: siteUrl, type: "website" }, twitter: { card: "summary_large_image", title: siteConfig.profile.companyName.en, description: siteConfig.profile.description.en } };
    }
  } catch {
    // Build and no-binding test environments use the generic root metadata.
  }
  return { title: "Travel site", robots: { index: false, follow: false } };
}

export default async function Home() {
  let initialSiteConfig: TenantSiteConfig | null = null;
  try {
    const tenant = await getDefaultTenant();
    if (tenant) initialSiteConfig = await getTenantSiteConfig(tenant);
  } catch (error) {
    console.error("Failed to load default tenant page", error instanceof Error ? error.name : "UnknownError");
  }
  return <TenantHomeClient tenantSlug={DEFAULT_TENANT_SLUG} initialSiteConfig={initialSiteConfig} />;
}
