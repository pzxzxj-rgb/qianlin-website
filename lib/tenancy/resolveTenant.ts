import { and, asc, eq } from "drizzle-orm";
import { getDb } from "../../db";
import { tenantContactChannels, tenantHeroSlides, tenantSiteProfiles, tenants } from "../../db/schema";
import type { ResolvedTenant, TenantSiteConfig } from "./types";

export const DEFAULT_TENANT_SLUG = "qianlin-travel";

const tenantSlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export async function resolveActiveTenantBySlug(slug: string): Promise<ResolvedTenant | null> {
  if (!tenantSlugPattern.test(slug)) return null;
  const db = await getDb();
  const [tenant] = await db.select({
    id: tenants.id,
    slug: tenants.slug,
    nameZh: tenants.nameZh,
    nameEn: tenants.nameEn,
    status: tenants.status,
    defaultLanguage: tenants.defaultLanguage,
    isDemo: tenants.isDemo,
  }).from(tenants).where(and(eq(tenants.slug, slug), eq(tenants.status, "active"))).limit(1);
  if (!tenant) return null;
  return {
    id: tenant.id,
    slug: tenant.slug,
    name: { zh: tenant.nameZh, en: tenant.nameEn },
    status: tenant.status,
    defaultLanguage: tenant.defaultLanguage === "en" ? "en" : "zh",
    isDemo: Boolean(tenant.isDemo),
  };
}

export async function getDefaultTenant() {
  return resolveActiveTenantBySlug(DEFAULT_TENANT_SLUG);
}

export async function getTenantSiteConfig(tenant: ResolvedTenant): Promise<TenantSiteConfig> {
  const db = await getDb();
  const [profileRows, contactRows, heroRows] = await Promise.all([
    db.select().from(tenantSiteProfiles).where(and(eq(tenantSiteProfiles.tenantId, tenant.id), eq(tenantSiteProfiles.status, "published"))).limit(1),
    db.select().from(tenantContactChannels).where(and(eq(tenantContactChannels.tenantId, tenant.id), eq(tenantContactChannels.status, "published"))).orderBy(asc(tenantContactChannels.displayOrder), asc(tenantContactChannels.id)),
    db.select().from(tenantHeroSlides).where(and(eq(tenantHeroSlides.tenantId, tenant.id), eq(tenantHeroSlides.status, "published"))).orderBy(asc(tenantHeroSlides.displayOrder), asc(tenantHeroSlides.id)).limit(2),
  ]);
  const profile = profileRows[0];
  return {
    tenant: {
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      defaultLanguage: tenant.defaultLanguage,
      isDemo: tenant.isDemo,
    },
    profile: {
      companyName: { zh: profile?.companyNameZh || tenant.name.zh, en: profile?.companyNameEn || tenant.name.en },
      description: { zh: profile?.descriptionZh ?? "", en: profile?.descriptionEn ?? "" },
      address: { zh: profile?.addressZh ?? "", en: profile?.addressEn ?? "" },
      logo: { mark: profile?.logoMark ?? "", imageUrl: profile?.logoImageUrl ?? "" },
      images: {
        about: { src: profile?.aboutImageUrl ?? "", alt: { zh: profile?.aboutImageAltZh ?? "", en: profile?.aboutImageAltEn ?? "" } },
        customize: { src: profile?.customizeImageUrl ?? "", alt: { zh: profile?.customizeImageAltZh ?? "", en: profile?.customizeImageAltEn ?? "" } },
      },
    },
    contacts: contactRows.map((contact) => ({
      id: contact.id,
      type: contact.type,
      label: { zh: contact.labelZh, en: contact.labelEn },
      value: contact.value,
      ...(contact.href ? { href: contact.href } : {}),
    })),
    heroSlides: heroRows.map((slide) => ({
      id: slide.id,
      src: slide.imageUrl,
      alt: { zh: slide.altZh, en: slide.altEn },
      desktopPosition: slide.desktopPosition,
      mobilePosition: slide.mobilePosition,
    })),
  };
}
