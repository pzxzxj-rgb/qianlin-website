"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { translations, type Language } from "../data/translations";

type LanguageContextValue = {
  language: Language;
  toggleLanguage: () => void;
  t: (typeof translations)[Language];
};

const LanguageContext = createContext<LanguageContextValue | null>(null);
export const LANGUAGE_STORAGE_KEY = "qianlin-language";

function isLanguage(value: string | null): value is Language {
  return value === "zh" || value === "en";
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>("zh");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const storedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
        if (isLanguage(storedLanguage)) setLanguage(storedLanguage);
      } catch {
        // Keep the Chinese default when localStorage is unavailable.
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
  }, [language]);

  const value = useMemo(() => ({
    language,
    toggleLanguage: () => setLanguage((current) => {
      const nextLanguage = current === "en" ? "zh" : "en";
      try {
        window.localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
      } catch {
        // Language switching still works when localStorage is unavailable.
      }
      return nextLanguage;
    }),
    t: translations[language],
  }), [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used inside LanguageProvider");
  return context;
}
