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
    if (!tenant) return { title: "网站不可用", robots: { index: false, follow: false } };
    const siteConfig = await getTenantSiteConfig(tenant);
    const isPublic = siteConfig.isConfigured && siteConfig.tenant.siteStatus === "published" && !siteConfig.tenant.isDemo;
    const siteUrl = getSiteUrl();
    const path = tenant.slug === DEFAULT_TENANT_SLUG ? "/" : `/t/${tenant.slug}`;
    const title = siteConfig.profile.companyName.zh || tenant.name.zh;
    const description = siteConfig.profile.description.zh || siteConfig.profile.primaryRegion.zh || tenant.name.zh;
    const image = siteConfig.profile.ogImageUrl || "/og.png";
    return { title, description, alternates: { canonical: `${siteUrl}${path}` }, robots: isPublic ? undefined : { index: false, follow: false }, openGraph: { title, description, url: `${siteUrl}${path}`, type: "website", images: [{ url: image, width: 1792, height: 944, alt: `${title}视觉图` }] }, twitter: { card: "summary_large_image", title, description, images: [image] } };
  } catch {
    return { title: "黔林旅行社", description: "旅行网站暂时无法加载。", robots: { index: false, follow: false }, openGraph: { title: "黔林旅行社", description: "旅行网站暂时无法加载。", images: ["/og.png"] }, twitter: { card: "summary_large_image", title: "黔林旅行社", description: "旅行网站暂时无法加载。", images: ["/og.png"] } };
  }
}

export default async function TenantPage({ params }: TenantPageProps) {
  const { tenantSlug } = await params;
  if (tenantSlug === DEFAULT_TENANT_SLUG) redirect("/");
  const tenant = await resolveActiveTenantBySlug(tenantSlug).catch(() => null);
  if (!tenant) notFound();
  let siteConfig: TenantSiteConfig | null = null;
  try {
    siteConfig = await getTenantSiteConfig(tenant);
  } catch (error) {
    console.error("Failed to load tenant site config", error instanceof Error ? error.name : "UnknownError");
  }
  return <TenantHomeClient tenantSlug={tenant.slug} initialSiteConfig={siteConfig} />;
}
