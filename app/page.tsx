"use client";

import { useState } from "react";
import { About } from "../components/About";
import { Contact } from "../components/Contact";
import { CustomizeForm } from "../components/CustomizeForm";
import { Destinations } from "../components/Destinations";
import { FAQ } from "../components/FAQ";
import { Footer } from "../components/Footer";
import { Hero } from "../components/Hero";
import { HowItWorks } from "../components/HowItWorks";
import { ItineraryPlanner, type ItineraryPlannerSubmission } from "../components/ItineraryPlanner";
import { LanguageProvider } from "../components/LanguageContext";
import { Navbar } from "../components/Navbar";
import { PlannerOptionsProvider } from "../components/PlannerOptionsProvider";
import { Services } from "../components/Services";
import { Tours } from "../components/Tours";
import { company } from "../data/siteConfig";
import { getVisibleTours } from "../lib/tours";

type InquiryPrefill = {
  tourName?: string;
  places?: string;
  message?: string;
};

export default function Home() {
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [inquiryPrefill, setInquiryPrefill] = useState<InquiryPrefill>({});
  const visibleTours = getVisibleTours(company.tours, company.id);
  const hasVisibleTours = visibleTours.length > 0;
  const openCustomize = (prefill: InquiryPrefill = {}) => {
    setInquiryPrefill(prefill);
    setCustomizeOpen(true);
  };
  const openTourCustomize = (tourName: string) => openCustomize({ tourName });
  const openDestinationCustomize = (places: string) => openCustomize({ places });
  const openItineraryCustomize = (submission: ItineraryPlannerSubmission) => openCustomize({ places: submission.places, message: submission.message });
  const closeCustomize = () => {
    setCustomizeOpen(false);
    setInquiryPrefill({});
  };

  return <LanguageProvider><PlannerOptionsProvider><Navbar showTours={hasVisibleTours} onBookNow={() => openCustomize()} /><main><Hero showTours={hasVisibleTours} onCustomize={() => openCustomize()} />{hasVisibleTours ? <Tours tours={visibleTours} onBook={openTourCustomize} /> : null}<Destinations onSelectDestination={openDestinationCustomize} /><ItineraryPlanner tenantId={company.id} onSendToConsultant={openItineraryCustomize} /><Services /><HowItWorks /><CustomizeForm open={customizeOpen} initialTourName={inquiryPrefill.tourName} initialPlaces={inquiryPrefill.places} initialMessage={inquiryPrefill.message} onOpen={() => openCustomize()} onClose={closeCustomize} /><About /><FAQ /><Contact onEnquire={() => openCustomize()} /></main><Footer showTours={hasVisibleTours} /></PlannerOptionsProvider></LanguageProvider>;
}
