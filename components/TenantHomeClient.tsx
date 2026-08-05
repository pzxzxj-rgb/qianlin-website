"use client";

import { useMemo, useState } from "react";
import { About } from "./About";
import { Contact } from "./Contact";
import { CustomizeForm } from "./CustomizeForm";
import { Destinations } from "./Destinations";
import { FAQ } from "./FAQ";
import { Footer } from "./Footer";
import { Hero } from "./Hero";
import { HowItWorks } from "./HowItWorks";
import { ItineraryPlanner, type ItineraryPlannerSubmission } from "./ItineraryPlanner";
import { LanguageProvider, useLanguage } from "./LanguageContext";
import { Navbar } from "./Navbar";
import { PlannerOptionsProvider } from "./PlannerOptionsProvider";
import { Services } from "./Services";
import { TenantSiteProvider, useTenantSite } from "./TenantSiteProvider";
import { Tours } from "./Tours";
import { getVisibleTours } from "../lib/tours";
import type { TenantSiteConfig } from "../lib/tenancy/types";

type InquiryPrefill = { tourName?: string; places?: string; message?: string };

function emptySiteConfig(tenantSlug: string): TenantSiteConfig {
  return {
    tenant: { id: tenantSlug, slug: tenantSlug, name: { zh: "旅行服务", en: "Travel service" }, siteStatus: "configuring", defaultLanguage: "zh", isDemo: false },
    isConfigured: false,
    profile: {
      companyName: { zh: "旅行服务", en: "Travel service" },
      description: { zh: "", en: "" },
      primaryRegion: { zh: "", en: "" },
      address: { zh: "", en: "" },
      logo: { mark: "", imageUrl: "" },
      images: { about: { src: "", alt: { zh: "", en: "" } }, customize: { src: "", alt: { zh: "", en: "" } } },
    },
    contacts: [],
    heroSlides: [],
  };
}

function TenantHomeContent({ tenantSlug }: { tenantSlug: string }) {
  const { status, config, retry } = useTenantSite();
  const { t } = useLanguage();
  const siteConfig = config ?? emptySiteConfig(tenantSlug);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [inquiryPrefill, setInquiryPrefill] = useState<InquiryPrefill>({});
  const visibleTours = useMemo(() => getVisibleTours([], siteConfig.tenant.id), [siteConfig.tenant.id]);
  const hasVisibleTours = visibleTours.length > 0;
  const openCustomize = (prefill: InquiryPrefill = {}) => { setInquiryPrefill(prefill); setCustomizeOpen(true); };
  const openTourCustomize = (tourName: string) => openCustomize({ tourName });
  const openDestinationCustomize = (places: string) => openCustomize({ places });
  const openItineraryCustomize = (submission: ItineraryPlannerSubmission) => openCustomize({ places: submission.places, message: submission.message });
  const closeCustomize = () => { setCustomizeOpen(false); setInquiryPrefill({}); };

  if (!config || !siteConfig.isConfigured) return <main className="tenant-state-page"><div className="tenant-state-card"><span className="eyebrow">{t.configuring.eyebrow}</span><h1>{t.configuring.title}</h1><p>{t.configuring.description}</p><strong>{t.configuring.label}</strong>{status === "error" ? <button type="button" className="button button-dark" onClick={retry}>{t.planner.retry}</button> : null}</div></main>;

  const isDemo = siteConfig.tenant.isDemo;
  if (isDemo) return <><Navbar siteConfig={siteConfig} showTours={false} onBookNow={() => undefined} /><main><About siteConfig={siteConfig} /></main><Footer siteConfig={siteConfig} showTours={false} /></>;

  return <PlannerOptionsProvider key={tenantSlug} tenantSlug={tenantSlug}><Navbar siteConfig={siteConfig} showTours={hasVisibleTours} onBookNow={() => openCustomize()} /><main><Hero slides={siteConfig.heroSlides} region={siteConfig.profile.primaryRegion} showTours={hasVisibleTours} onCustomize={() => openCustomize()} />{hasVisibleTours ? <Tours tours={visibleTours} region={siteConfig.profile.primaryRegion} onBook={openTourCustomize} /> : null}<Destinations onSelectDestination={openDestinationCustomize} /><ItineraryPlanner tenantId={siteConfig.tenant.id} onSendToConsultant={openItineraryCustomize} /><Services /><HowItWorks /><CustomizeForm tenantSlug={tenantSlug} siteConfig={siteConfig} open={customizeOpen} initialTourName={inquiryPrefill.tourName} initialPlaces={inquiryPrefill.places} initialMessage={inquiryPrefill.message} onOpen={() => openCustomize()} onClose={closeCustomize} /><About siteConfig={siteConfig} /><FAQ /><Contact siteConfig={siteConfig} onEnquire={() => openCustomize()} /></main><Footer siteConfig={siteConfig} showTours={hasVisibleTours} /></PlannerOptionsProvider>;
}

export function TenantHomeClient({ tenantSlug, initialSiteConfig }: { tenantSlug: string; initialSiteConfig: TenantSiteConfig | null }) {
  const initialLanguage = initialSiteConfig?.tenant.defaultLanguage ?? "zh";
  return <LanguageProvider key={tenantSlug} initialLanguage={initialLanguage} storageKey={`travel-language:${tenantSlug}`}><TenantSiteProvider key={tenantSlug} tenantSlug={tenantSlug} initialConfig={initialSiteConfig}><TenantHomeContent tenantSlug={tenantSlug} /></TenantSiteProvider></LanguageProvider>;
}
