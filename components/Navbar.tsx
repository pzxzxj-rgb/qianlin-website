"use client";

import { useEffect, useState } from "react";
import { company } from "../data/siteConfig";
import { useLanguage } from "./LanguageContext";

type NavbarProps = { showTours: boolean; onBookNow: () => void };

export function Navbar({ showTours, onBookNow }: NavbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { language, toggleLanguage, t } = useLanguage();
  const closeMenu = () => setMenuOpen(false);

  useEffect(() => {
    const updateScrollState = () => setScrolled(window.scrollY > 24);
    updateScrollState();
    window.addEventListener("scroll", updateScrollState, { passive: true });
    return () => window.removeEventListener("scroll", updateScrollState);
  }, []);

  return (
    <header className={`site-header${scrolled ? " site-header-scrolled" : ""}`}>
      <div className="header-inner">
        <a href="#home" className="brand" onClick={closeMenu} aria-label={company.logo.alt[language]}>
          <span className="brand-mark">{company.logo.mark}</span>
          <span className="brand-copy"><strong>{company.name}</strong><small>{company.nameZh}</small></span>
        </a>
        <button type="button" className="mobile-menu-button" onClick={() => setMenuOpen((open) => !open)} aria-expanded={menuOpen} aria-label={language === "zh" ? "打开导航菜单" : "Toggle navigation"}><span /><span /></button>
        <div className={`nav-panel ${menuOpen ? "nav-panel-open" : ""}`}>
          <nav className="main-nav" aria-label={language === "zh" ? "主导航" : "Main navigation"}>
            <a href="#home" onClick={closeMenu}>{t.nav.home}</a>
            <a href="#destinations" onClick={closeMenu}>{t.nav.destinations}</a>
            {showTours ? <a href="#tours" onClick={closeMenu}>{t.nav.tours}</a> : null}
            <a href="#customize" onClick={closeMenu}>{t.nav.customize}</a>
            <a href="#about" onClick={closeMenu}>{t.nav.about}</a>
            <a href="#contact" onClick={closeMenu}>{t.nav.contact}</a>
          </nav>
          <div className="header-actions">
            <button type="button" className="language-switch" onClick={toggleLanguage} aria-label={t.nav.aria}><span>{language === "en" ? "中文" : "EN"}</span></button>
            <button type="button" className="button button-dark button-small" onClick={() => { closeMenu(); onBookNow(); }}>{t.nav.book} <span aria-hidden="true">→</span></button>
          </div>
        </div>
      </div>
    </header>
  );
}
