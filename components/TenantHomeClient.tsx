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
import { LanguageProvider } from "./LanguageContext";
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
    tenant: { id: tenantSlug, slug: tenantSlug, name: { zh: "旅行服务", en: "Travel service" }, defaultLanguage: "zh", isDemo: false },
    profile: {
      companyName: { zh: "旅行服务", en: "Travel service" },
      description: { zh: "", en: "" },
      address: { zh: "", en: "" },
      logo: { mark: "", imageUrl: "" },
      images: { about: { src: "", alt: { zh: "", en: "" } }, customize: { src: "", alt: { zh: "", en: "" } } },
    },
    contacts: [],
    heroSlides: [],
  };
}

function TenantHomeContent({ tenantSlug }: { tenantSlug: string }) {
  const { config } = useTenantSite();
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

  const isDemo = siteConfig.tenant.isDemo;
  return <PlannerOptionsProvider tenantSlug={tenantSlug}><Navbar siteConfig={siteConfig} showTours={hasVisibleTours} onBookNow={() => openCustomize()} /><main><Hero slides={siteConfig.heroSlides} demoName={isDemo ? siteConfig.profile.companyName : undefined} demoDescription={isDemo ? siteConfig.profile.description : undefined} showTours={hasVisibleTours} onCustomize={() => openCustomize()} />{isDemo ? <About siteConfig={siteConfig} /> : <>{hasVisibleTours ? <Tours tours={visibleTours} onBook={openTourCustomize} /> : null}<Destinations onSelectDestination={openDestinationCustomize} /><ItineraryPlanner tenantId={siteConfig.tenant.id} onSendToConsultant={openItineraryCustomize} /><Services /><HowItWorks /><CustomizeForm tenantSlug={tenantSlug} siteConfig={siteConfig} open={customizeOpen} initialTourName={inquiryPrefill.tourName} initialPlaces={inquiryPrefill.places} initialMessage={inquiryPrefill.message} onOpen={() => openCustomize()} onClose={closeCustomize} /><About siteConfig={siteConfig} /><FAQ /><Contact siteConfig={siteConfig} onEnquire={() => openCustomize()} /></>}</main><Footer siteConfig={siteConfig} showTours={hasVisibleTours} /></PlannerOptionsProvider>;
}

export function TenantHomeClient({ tenantSlug, initialSiteConfig }: { tenantSlug: string; initialSiteConfig: TenantSiteConfig | null }) {
  return <LanguageProvider><TenantSiteProvider tenantSlug={tenantSlug} initialConfig={initialSiteConfig}><TenantHomeContent tenantSlug={tenantSlug} /></TenantSiteProvider></LanguageProvider>;
}
