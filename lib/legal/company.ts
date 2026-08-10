import { DEFAULT_LEGAL_COMPANY, type LegalCompanyProfile } from "../../data/legal";
import { DEFAULT_TENANT_SLUG, getDefaultTenant, getTenantSiteConfig } from "../tenancy/resolveTenant";

export async function getCurrentLegalCompany(): Promise<LegalCompanyProfile> {
  try {
    const tenant = await getDefaultTenant();
    if (!tenant || tenant.slug !== DEFAULT_TENANT_SLUG || tenant.isDemo || tenant.siteStatus !== "published") {
      return DEFAULT_LEGAL_COMPANY;
    }

    const siteConfig = await getTenantSiteConfig(tenant);
    if (!siteConfig.isConfigured || siteConfig.tenant.slug !== DEFAULT_TENANT_SLUG || siteConfig.tenant.isDemo) {
      return DEFAULT_LEGAL_COMPANY;
    }

    return {
      companyNameZh: siteConfig.profile.companyName.zh.trim() || DEFAULT_LEGAL_COMPANY.companyNameZh,
      companyNameEn: siteConfig.profile.companyName.en.trim() || DEFAULT_LEGAL_COMPANY.companyNameEn,
      addressZh: siteConfig.profile.address.zh.trim() || DEFAULT_LEGAL_COMPANY.addressZh,
      email: (siteConfig.contacts.find((channel) => channel.type === "email")?.value ?? "").trim(),
      logoMark: siteConfig.profile.logo.mark.trim(),
    };
  } catch {
    return DEFAULT_LEGAL_COMPANY;
  }
}
