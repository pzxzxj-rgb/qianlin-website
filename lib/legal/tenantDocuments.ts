import { eq } from "drizzle-orm";
import { getDb } from "../../db";
import { tenantLegalPages } from "../../db/schema";
import type { LegalCompanyProfile, LegalDocument } from "../../data/legal";
import { resolveActiveTenantBySlug, getTenantSiteConfig } from "../tenancy/resolveTenant";

export type TenantLegalKind = "privacy" | "terms" | "refund";

function documentFromText(kind: TenantLegalKind, text: string, policyVersion: string): LegalDocument {
  const titles: Record<TenantLegalKind, string> = { privacy: "隐私政策", terms: "用户服务条款", refund: "退款与取消政策" };
  return {
    title: titles[kind],
    effectiveDate: policyVersion,
    sections: text.split(/\r?\n+/).map((paragraph, index) => ({ heading: index === 0 ? "政策说明" : `政策内容 ${index + 1}`, paragraphs: paragraph.trim() ? [paragraph.trim()] : [] })).filter((section) => section.paragraphs?.length),
  };
}

export async function getTenantLegalDocument(slug: string, kind: TenantLegalKind): Promise<{ document: LegalDocument; company: LegalCompanyProfile; homePath: string; isPublic: boolean } | null> {
  const tenant = await resolveActiveTenantBySlug(slug);
  if (!tenant) return null;
  const db = await getDb();
  const [row] = await db.select().from(tenantLegalPages).where(eq(tenantLegalPages.tenantId, tenant.id)).limit(1);
  if (!row) return null;
  const siteConfig = await getTenantSiteConfig(tenant);
  const email = siteConfig.contacts.find((contact) => contact.type === "email")?.value ?? "";
  const company: LegalCompanyProfile = {
    companyNameZh: siteConfig.profile.companyName.zh || tenant.name.zh,
    companyNameEn: siteConfig.profile.companyName.en || tenant.name.en,
    addressZh: siteConfig.profile.address.zh,
    email,
    logoMark: siteConfig.profile.logo.mark,
  };
  const field = kind === "privacy" ? { zh: row.privacyZh, en: row.privacyEn } : kind === "terms" ? { zh: row.termsZh, en: row.termsEn } : { zh: row.refundZh, en: row.refundEn };
  return { document: documentFromText(kind, field.zh || field.en, row.policyVersion), company, homePath: `/t/${encodeURIComponent(tenant.slug)}`, isPublic: tenant.siteStatus === "published" && !tenant.isDemo };
}
