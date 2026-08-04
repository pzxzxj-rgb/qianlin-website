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
import { LanguageProvider } from "../components/LanguageContext";
import { Navbar } from "../components/Navbar";
import { Services } from "../components/Services";
import { Tours } from "../components/Tours";
import { company } from "../data/siteConfig";
import { getVisibleTours } from "../lib/tours";

export default function Home() {
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [selectedTour, setSelectedTour] = useState("");
  const visibleTours = getVisibleTours(company.tours, company.id);
  const hasVisibleTours = visibleTours.length > 0;
  const openCustomize = (tourName = "") => {
    setSelectedTour(tourName);
    setCustomizeOpen(true);
  };
  const closeCustomize = () => {
    setCustomizeOpen(false);
    setSelectedTour("");
  };

  return <LanguageProvider><Navbar showTours={hasVisibleTours} onBookNow={() => openCustomize()} /><main><Hero showTours={hasVisibleTours} onCustomize={() => openCustomize()} />{hasVisibleTours ? <Tours tours={visibleTours} onBook={openCustomize} /> : null}<Destinations destinations={company.destinations} /><Services /><HowItWorks /><CustomizeForm open={customizeOpen} initialTourName={selectedTour} onOpen={() => openCustomize()} onClose={closeCustomize} /><About /><FAQ /><Contact /></main><Footer showTours={hasVisibleTours} /></LanguageProvider>;
}
