import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { TenantHomeClient } from "../../../components/TenantHomeClient";
import { DEFAULT_TENANT_SLUG, getTenantSiteConfig, resolveActiveTenantBySlug } from "../../../lib/tenancy/resolveTenant";
import type { TenantSiteConfig } from "../../../lib/tenancy/types";

type TenantPageProps = { params: Promise<{ tenantSlug: string }> };

export async function generateMetadata({ params }: TenantPageProps): Promise<Metadata> {
  const { tenantSlug } = await params;
  try {
    const tenant = await resolveActiveTenantBySlug(tenantSlug);
    if (!tenant) return { title: "Site unavailable", robots: { index: false, follow: false } };
    const siteConfig = await getTenantSiteConfig(tenant);
    const isPublic = siteConfig.isConfigured && siteConfig.tenant.siteStatus === "published" && !siteConfig.tenant.isDemo;
    return {
      title: siteConfig.profile.companyName.zh || tenant.name.zh,
      description: siteConfig.profile.description.zh || siteConfig.profile.primaryRegion.zh || tenant.name.en,
      alternates: { canonical: tenant.slug === DEFAULT_TENANT_SLUG ? "/" : `/t/${tenant.slug}` },
      robots: isPublic ? undefined : { index: false, follow: false },
      openGraph: { title: siteConfig.profile.companyName.en || tenant.name.en, description: siteConfig.profile.description.en || siteConfig.profile.primaryRegion.en, url: tenant.slug === DEFAULT_TENANT_SLUG ? "/" : `/t/${tenant.slug}`, type: "website" },
      twitter: { card: "summary_large_image", title: siteConfig.profile.companyName.en || tenant.name.en, description: siteConfig.profile.description.en || siteConfig.profile.primaryRegion.en },
    };
  } catch {
    return { title: "Travel site", robots: { index: false, follow: false } };
  }
}

export default async function TenantPage({ params }: TenantPageProps) {
  const { tenantSlug } = await params;
  if (tenantSlug === DEFAULT_TENANT_SLUG) redirect("/");
  let tenant = null;
  try {
    tenant = await resolveActiveTenantBySlug(tenantSlug);
  } catch (error) {
    console.error("Failed to load tenant page", error instanceof Error ? error.name : "UnknownError");
    return <TenantHomeClient tenantSlug={tenantSlug} initialSiteConfig={null} />;
  }
  if (!tenant) notFound();
  let siteConfig: TenantSiteConfig | null = null;
  try {
    siteConfig = await getTenantSiteConfig(tenant);
  } catch (error) {
    console.error("Failed to load tenant site config", error instanceof Error ? error.name : "UnknownError");
  }
  return <TenantHomeClient tenantSlug={tenant.slug} initialSiteConfig={siteConfig} />;
}
