import type { Metadata } from "next";
import { TenantHomeClient } from "../components/TenantHomeClient";
import { DEFAULT_TENANT_SLUG, getDefaultTenant, getTenantSiteConfig } from "../lib/tenancy/resolveTenant";
import { getSiteUrl } from "../lib/siteUrl";
import type { TenantSiteConfig } from "../lib/tenancy/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const defaultTitle = "黔林旅行社｜贵州旅行咨询·行程规划·私人定制";
const defaultDescription = "黔林旅行社提供贵州及周边旅行咨询、目的地信息、参考行程规划与定制服务。告诉我们出行时间、人数和旅行偏好，由旅行顾问结合实际资源进一步确认旅行方案。";

export async function generateMetadata(): Promise<Metadata> {
  try {
    const tenant = await getDefaultTenant();
    if (tenant) {
      const siteConfig = await getTenantSiteConfig(tenant);
      const isPublic = siteConfig.isConfigured && siteConfig.tenant.siteStatus === "published";
      const siteUrl = await getSiteUrl();
      const brandName = siteConfig.profile.companyName.zh || "黔林旅行社";
      const title = `${brandName}｜贵州旅行咨询·行程规划·私人定制`;
      const description = siteConfig.profile.description.zh || siteConfig.profile.primaryRegion.zh || defaultDescription;
      const image = siteConfig.profile.ogImageUrl || "/og.png";
      return { title, description, alternates: { canonical: siteUrl }, robots: isPublic && !siteConfig.tenant.isDemo ? undefined : { index: false, follow: false }, openGraph: { title, description, url: siteUrl, type: "website", images: [{ url: image, width: 1792, height: 944, alt: "黔林旅行社贵州旅行视觉图" }] }, twitter: { card: "summary_large_image", title, description, images: [image] } };
    }
  } catch {
    // Missing local bindings or an invalid production URL must not create public metadata.
  }
  return { title: defaultTitle, description: defaultDescription, robots: { index: false, follow: false }, openGraph: { title: defaultTitle, description: defaultDescription, images: ["/og.png"] }, twitter: { card: "summary_large_image", title: defaultTitle, description: defaultDescription, images: ["/og.png"] } };
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
