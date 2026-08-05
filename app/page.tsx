import type { Metadata } from "next";
import { TenantHomeClient } from "../components/TenantHomeClient";
import { DEFAULT_TENANT_SLUG, getDefaultTenant, getTenantSiteConfig } from "../lib/tenancy/resolveTenant";
import type { TenantSiteConfig } from "../lib/tenancy/types";

export async function generateMetadata(): Promise<Metadata> {
  try {
    const tenant = await getDefaultTenant();
    if (tenant) {
      const siteConfig = await getTenantSiteConfig(tenant);
      return { title: siteConfig.profile.companyName.zh, description: siteConfig.profile.description.zh, alternates: { canonical: "/" } };
    }
  } catch {
    // Build and no-binding test environments use the generic root metadata.
  }
  return { title: "Travel site", alternates: { canonical: "/" } };
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
