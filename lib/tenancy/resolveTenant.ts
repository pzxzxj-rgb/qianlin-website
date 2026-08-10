import { and, asc, eq } from "drizzle-orm";
import { getDb } from "../../db";
import { tenantContactChannels, tenantHeroSlides, tenantSiteProfiles, tenantTours, tenants } from "../../db/schema";
import { isAdminImagePathForUsage, isSafeOgImagePath } from "../admin/imageCatalog";
import { sanitizeContactHref } from "./sanitizeContactHref";
import type { ResolvedTenant, TenantSiteConfig } from "./types";
import type { Tour } from "../../types/tour";

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
    siteStatus: tenants.siteStatus,
    defaultLanguage: tenants.defaultLanguage,
    isDemo: tenants.isDemo,
  }).from(tenants).where(and(eq(tenants.slug, slug), eq(tenants.status, "active"))).limit(1);
  if (!tenant) return null;
  return {
    id: tenant.id,
    slug: tenant.slug,
    name: { zh: tenant.nameZh, en: tenant.nameEn },
    status: tenant.status,
    siteStatus: tenant.siteStatus === "published" ? "published" : "configuring",
    defaultLanguage: tenant.defaultLanguage === "en" ? "en" : "zh",
    isDemo: Boolean(tenant.isDemo),
  };
}

export async function getDefaultTenant() {
  return resolveActiveTenantBySlug(DEFAULT_TENANT_SLUG);
}

function unconfiguredSiteConfig(tenant: ResolvedTenant): TenantSiteConfig {
  return {
    tenant: {
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      siteStatus: tenant.siteStatus,
      defaultLanguage: tenant.defaultLanguage,
      isDemo: tenant.isDemo,
    },
    isConfigured: false,
    profile: {
      companyName: tenant.name,
      description: { zh: "", en: "" },
      primaryRegion: { zh: "", en: "" },
      address: { zh: "", en: "" },
      logo: { mark: "", imageUrl: "" },
      ogImageUrl: "/og.png",
      images: {
        about: { src: "", alt: { zh: "", en: "" } },
        customize: { src: "", alt: { zh: "", en: "" } },
      },
    },
    contacts: [],
    tours: [],
    heroSlides: [],
  };
}

function mapPublicTour(row: typeof tenantTours.$inferSelect): Tour {
  const hasSafeImage = isAdminImagePathForUsage(row.imageUrl, "tour");
  return {
    id: row.id,
    tenantId: row.tenantId,
    slug: row.slug,
    title: { zh: row.titleZh, en: row.titleEn },
    description: { zh: row.descriptionZh, en: row.descriptionEn },
    ...(row.durationZh || row.durationEn ? { duration: { zh: row.durationZh, en: row.durationEn } } : {}),
    ...(row.tagZh || row.tagEn ? { tag: { zh: row.tagZh, en: row.tagEn } } : {}),
    ...(row.priceTextZh || row.priceTextEn ? { priceText: { zh: row.priceTextZh, en: row.priceTextEn } } : {}),
    ...(hasSafeImage ? { image: row.imageUrl, imageAlt: { zh: row.imageAltZh, en: row.imageAltEn } } : {}),
    featured: Boolean(row.featured),
    displayOrder: row.displayOrder,
    status: row.status === "published" || row.status === "archived" ? row.status : "draft",
  };
}

export async function getTenantSiteConfig(tenant: ResolvedTenant): Promise<TenantSiteConfig> {
  const db = await getDb();
  if (tenant.siteStatus !== "published") return unconfiguredSiteConfig(tenant);

  const profileRows = await db.select().from(tenantSiteProfiles).where(and(eq(tenantSiteProfiles.tenantId, tenant.id), eq(tenantSiteProfiles.status, "published"))).limit(1);
  const profile = profileRows[0];
  if (!profile) return unconfiguredSiteConfig(tenant);

  const [contactRows, heroRows, tourRows] = await Promise.all([
    db.select().from(tenantContactChannels).where(and(eq(tenantContactChannels.tenantId, tenant.id), eq(tenantContactChannels.status, "published"))).orderBy(asc(tenantContactChannels.displayOrder), asc(tenantContactChannels.id)),
    db.select().from(tenantHeroSlides).where(and(eq(tenantHeroSlides.tenantId, tenant.id), eq(tenantHeroSlides.status, "published"))).orderBy(asc(tenantHeroSlides.displayOrder), asc(tenantHeroSlides.id)).limit(2),
    db.select().from(tenantTours).where(and(eq(tenantTours.tenantId, tenant.id), eq(tenantTours.status, "published"))).orderBy(asc(tenantTours.displayOrder), asc(tenantTours.id)),
  ]);

  return {
    tenant: {
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      siteStatus: tenant.siteStatus,
      defaultLanguage: tenant.defaultLanguage,
      isDemo: tenant.isDemo,
    },
    isConfigured: true,
    profile: {
      companyName: { zh: profile?.companyNameZh || tenant.name.zh, en: profile?.companyNameEn || tenant.name.en },
      description: { zh: profile?.descriptionZh ?? "", en: profile?.descriptionEn ?? "" },
      primaryRegion: { zh: profile?.primaryRegionZh ?? "", en: profile?.primaryRegionEn ?? "" },
      address: { zh: profile?.addressZh ?? "", en: profile?.addressEn ?? "" },
      logo: { mark: profile?.logoMark ?? "", imageUrl: profile?.logoImageUrl ?? "" },
      ogImageUrl: isSafeOgImagePath(profile?.ogImageUrl) ? profile.ogImageUrl : "/og.png",
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
      ...(sanitizeContactHref(contact.href) ? { href: sanitizeContactHref(contact.href) } : {}),
    })),
    tours: tourRows.map(mapPublicTour),
    heroSlides: heroRows.map((slide) => ({
      id: slide.id,
      src: slide.imageUrl,
      alt: { zh: slide.altZh, en: slide.altEn },
      desktopPosition: slide.desktopPosition,
      mobilePosition: slide.mobilePosition,
    })),
  };
}
