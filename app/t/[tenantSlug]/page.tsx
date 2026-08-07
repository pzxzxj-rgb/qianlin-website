import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { TenantHomeClient } from "../../../components/TenantHomeClient";
import { DEFAULT_TENANT_SLUG, getTenantSiteConfig, resolveActiveTenantBySlug } from "../../../lib/tenancy/resolveTenant";
import { getSiteUrl } from "../../../lib/siteUrl";
import type { TenantSiteConfig } from "../../../lib/tenancy/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type TenantPageProps = { params: Promise<{ tenantSlug: string }> };

export async function generateMetadata({ params }: TenantPageProps): Promise<Metadata> {
  const { tenantSlug } = await params;
  try {
    const tenant = await resolveActiveTenantBySlug(tenantSlug);
    if (!tenant) return { title: "Site unavailable", robots: { index: false, follow: false } };
    const siteConfig = await getTenantSiteConfig(tenant);
    const isPublic = siteConfig.isConfigured && siteConfig.tenant.siteStatus === "published" && !siteConfig.tenant.isDemo;
    const siteUrl = getSiteUrl();
    const path = tenant.slug === DEFAULT_TENANT_SLUG ? "/" : `/t/${tenant.slug}`;
    return {
      title: siteConfig.profile.companyName.zh || tenant.name.zh,
      description: siteConfig.profile.description.zh || siteConfig.profile.primaryRegion.zh || tenant.name.en,
      alternates: { canonical: `${siteUrl}${path}` },
      robots: isPublic ? undefined : { index: false, follow: false },
      openGraph: { title: siteConfig.profile.companyName.en || tenant.name.en, description: siteConfig.profile.description.en || siteConfig.profile.primaryRegion.en, url: `${siteUrl}${path}`, type: "website", images: [{ url: "/og.png", width: 1792, height: 944, alt: "黔林旅行社贵州旅行视觉图" }] },
      twitter: { card: "summary_large_image", title: siteConfig.profile.companyName.en || tenant.name.en, description: siteConfig.profile.description.en || siteConfig.profile.primaryRegion.en, images: ["/og.png"] },
    };
  } catch {
    return { title: "黔林旅行社｜贵州定制旅行", description: "黔林旅行社专注贵州目的地旅行，为你规划轻松、清晰、值得回味的旅程。", robots: { index: false, follow: false }, openGraph: { title: "黔林旅行社｜贵州定制旅行", description: "黔林旅行社专注贵州目的地旅行，为你规划轻松、清晰、值得回味的旅程。", images: ["/og.png"] }, twitter: { card: "summary_large_image", title: "黔林旅行社｜贵州定制旅行", description: "黔林旅行社专注贵州目的地旅行，为你规划轻松、清晰、值得回味的旅程。", images: ["/og.png"] } };
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
