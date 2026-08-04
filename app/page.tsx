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

export default function Home() {
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [selectedTour, setSelectedTour] = useState("");
  const openCustomize = (tourName = "") => {
    setSelectedTour(tourName);
    setCustomizeOpen(true);
  };
  const closeCustomize = () => {
    setCustomizeOpen(false);
    setSelectedTour("");
  };

  return <LanguageProvider><Navbar onBookNow={() => openCustomize()} /><main><Hero onCustomize={() => openCustomize()} /><Tours tours={company.tours} onBook={openCustomize} /><Destinations destinations={company.destinations} /><Services /><HowItWorks /><CustomizeForm open={customizeOpen} initialTourName={selectedTour} onOpen={() => openCustomize()} onClose={closeCustomize} /><About /><FAQ /><Contact /></main><Footer /></LanguageProvider>;
}
