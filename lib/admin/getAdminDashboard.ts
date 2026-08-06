import { and, count, eq, inArray } from "drizzle-orm";
import { getDb } from "../../db";
import { inquiries, plannerDestinations, tenantContactChannels, tenantHeroSlides, tenantSiteProfiles, tenantTours, tenants } from "../../db/schema";
import { ADMIN_TENANT_ID } from "./auth";

export type AdminDashboardData = {
  tenant: {
    id: string;
    slug: string;
    nameZh: string;
    nameEn: string;
    siteStatus: string;
    defaultLanguage: string;
  };
  profile: {
    companyNameZh: string;
    companyNameEn: string;
    descriptionZh: string;
    descriptionEn: string;
    addressZh: string;
    addressEn: string;
    logoMark: string;
  };
  contacts: {
    phone: string;
    email: string;
    wechat: string;
  };
  counts: {
    heroImages: number;
    tours: number;
    destinations: number;
    inquiries: number;
    newInquiries: number;
  };
};

export async function getAdminDashboard(tenantId: string): Promise<AdminDashboardData> {
  if (tenantId !== ADMIN_TENANT_ID) throw new Error("Invalid admin tenant boundary");
  const db = await getDb();
  const [tenantRows, profileRows, contactRows, heroCountRows, tourCountRows, destinationCountRows, inquiryCountRows, newInquiryCountRows] = await Promise.all([
    db.select({ id: tenants.id, slug: tenants.slug, nameZh: tenants.nameZh, nameEn: tenants.nameEn, siteStatus: tenants.siteStatus, defaultLanguage: tenants.defaultLanguage }).from(tenants).where(and(eq(tenants.id, ADMIN_TENANT_ID), eq(tenants.status, "active"))).limit(1),
    db.select({ companyNameZh: tenantSiteProfiles.companyNameZh, companyNameEn: tenantSiteProfiles.companyNameEn, descriptionZh: tenantSiteProfiles.descriptionZh, descriptionEn: tenantSiteProfiles.descriptionEn, addressZh: tenantSiteProfiles.addressZh, addressEn: tenantSiteProfiles.addressEn, logoMark: tenantSiteProfiles.logoMark }).from(tenantSiteProfiles).where(and(eq(tenantSiteProfiles.tenantId, ADMIN_TENANT_ID), eq(tenantSiteProfiles.status, "published"))).limit(1),
    db.select({ type: tenantContactChannels.type, value: tenantContactChannels.value }).from(tenantContactChannels).where(and(eq(tenantContactChannels.tenantId, ADMIN_TENANT_ID), eq(tenantContactChannels.status, "published"), inArray(tenantContactChannels.type, ["phone", "email", "wechat"]))),
    db.select({ value: count() }).from(tenantHeroSlides).where(and(eq(tenantHeroSlides.tenantId, ADMIN_TENANT_ID), eq(tenantHeroSlides.status, "published"))),
    db.select({ value: count() }).from(tenantTours).where(eq(tenantTours.tenantId, ADMIN_TENANT_ID)),
    db.select({ value: count() }).from(plannerDestinations).where(and(eq(plannerDestinations.tenantId, ADMIN_TENANT_ID), eq(plannerDestinations.status, "published"))),
    db.select({ value: count() }).from(inquiries).where(eq(inquiries.tenantId, ADMIN_TENANT_ID)),
    db.select({ value: count() }).from(inquiries).where(and(eq(inquiries.tenantId, ADMIN_TENANT_ID), eq(inquiries.status, "new"))),
  ]);

  const tenant = tenantRows[0];
  if (!tenant) throw new Error("Admin tenant is unavailable");
  const profile = profileRows[0];
  const contacts = { phone: "", email: "", wechat: "" };
  for (const contact of contactRows) {
    if (contact.type === "phone" || contact.type === "email" || contact.type === "wechat") contacts[contact.type] = contact.value;
  }

  return {
    tenant,
    profile: {
      companyNameZh: profile?.companyNameZh || tenant.nameZh,
      companyNameEn: profile?.companyNameEn || tenant.nameEn,
      descriptionZh: profile?.descriptionZh ?? "",
      descriptionEn: profile?.descriptionEn ?? "",
      addressZh: profile?.addressZh ?? "",
      addressEn: profile?.addressEn ?? "",
      logoMark: profile?.logoMark ?? "",
    },
    contacts,
    counts: {
      heroImages: Number(heroCountRows[0]?.value ?? 0),
      tours: Number(tourCountRows[0]?.value ?? 0),
      destinations: Number(destinationCountRows[0]?.value ?? 0),
      inquiries: Number(inquiryCountRows[0]?.value ?? 0),
      newInquiries: Number(newInquiryCountRows[0]?.value ?? 0),
    },
  };
}
