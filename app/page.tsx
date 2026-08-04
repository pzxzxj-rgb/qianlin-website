"use client";

import { useState } from "react";
import { About } from "../components/About";
import { Contact } from "../components/Contact";
import { CustomizeForm } from "../components/CustomizeForm";
import { Destinations } from "../components/Destinations";
import { FAQ } from "../components/FAQ";
import { Footer } from "../components/Footer";
import { Gallery } from "../components/Gallery";
import { Hero } from "../components/Hero";
import { HowItWorks } from "../components/HowItWorks";
import { LanguageProvider } from "../components/LanguageContext";
import { Navbar } from "../components/Navbar";
import { Services } from "../components/Services";
import { Tours } from "../components/Tours";
import { company } from "../data/siteConfig";

export default function Home() {
  const [customizeOpen, setCustomizeOpen] = useState(false);
  return <LanguageProvider><Navbar onBookNow={() => setCustomizeOpen(true)} /><main><Hero onCustomize={() => setCustomizeOpen(true)} /><Tours tours={company.tours} onBook={() => setCustomizeOpen(true)} /><Destinations destinations={company.destinations} /><Services /><HowItWorks /><CustomizeForm open={customizeOpen} onOpen={() => setCustomizeOpen(true)} onClose={() => setCustomizeOpen(false)} /><About /><Gallery /><FAQ /><Contact /></main><Footer /></LanguageProvider>;
}
