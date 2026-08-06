import type { Tour } from "../../types/tour";

export type TenantLanguage = "zh" | "en";

export type ResolvedTenant = {
  id: string;
  slug: string;
  name: { zh: string; en: string };
  status: string;
  siteStatus: "configuring" | "published";
  defaultLanguage: TenantLanguage;
  isDemo: boolean;
};

export type TenantSiteConfig = {
  tenant: {
    id: string;
    slug: string;
    name: { zh: string; en: string };
    siteStatus: "configuring" | "published";
    defaultLanguage: TenantLanguage;
    isDemo: boolean;
  };
  isConfigured: boolean;
  profile: {
    companyName: { zh: string; en: string };
    description: { zh: string; en: string };
    primaryRegion: { zh: string; en: string };
    address: { zh: string; en: string };
    logo: { mark: string; imageUrl: string };
    images: {
      about: { src: string; alt: { zh: string; en: string } };
      customize: { src: string; alt: { zh: string; en: string } };
    };
  };
  contacts: Array<{
    id: string;
    type: string;
    label: { zh: string; en: string };
    value: string;
    href?: string;
  }>;
  tours: Tour[];
  heroSlides: Array<{
    id: string;
    src: string;
    alt: { zh: string; en: string };
    desktopPosition: string;
    mobilePosition: string;
  }>;
};
