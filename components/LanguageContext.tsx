"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { translations, type Language } from "../data/translations";

type LanguageContextValue = {
  language: Language;
  toggleLanguage: () => void;
  t: (typeof translations)[Language];
};

const LanguageContext = createContext<LanguageContextValue | null>(null);
export const LANGUAGE_STORAGE_PREFIX = "travel-language:";

function isLanguage(value: string | null): value is Language {
  return value === "zh" || value === "en";
}

export function LanguageProvider({ children, initialLanguage = "zh", storageKey = `${LANGUAGE_STORAGE_PREFIX}default` }: { children: React.ReactNode; initialLanguage?: Language; storageKey?: string }) {
  const [language, setLanguage] = useState<Language>(initialLanguage);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const storedLanguage = window.localStorage.getItem(storageKey);
        if (isLanguage(storedLanguage)) setLanguage(storedLanguage);
      } catch {
        // Keep the Chinese default when localStorage is unavailable.
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [initialLanguage, storageKey]);

  useEffect(() => {
    document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
  }, [language]);

  const value = useMemo(() => ({
    language,
    toggleLanguage: () => setLanguage((current) => {
      const nextLanguage = current === "en" ? "zh" : "en";
      try {
        window.localStorage.setItem(storageKey, nextLanguage);
      } catch {
        // Language switching still works when localStorage is unavailable.
      }
      return nextLanguage;
    }),
    t: translations[language],
  }), [language, storageKey]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used inside LanguageProvider");
  return context;
}
