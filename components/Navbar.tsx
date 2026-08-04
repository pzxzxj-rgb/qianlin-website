"use client";

import { useEffect, useRef, useState } from "react";
import { company } from "../data/siteConfig";
import { useLanguage } from "./LanguageContext";

type NavbarProps = { showTours: boolean; onBookNow: () => void };

export function Navbar({ showTours, onBookNow }: NavbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const { language, toggleLanguage, t } = useLanguage();
  const closeMenu = () => setMenuOpen(false);

  useEffect(() => {
    const updateScrollState = () => setScrolled(window.scrollY > 24);
    updateScrollState();
    window.addEventListener("scroll", updateScrollState, { passive: true });
    return () => window.removeEventListener("scroll", updateScrollState);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setMenuOpen(false);
      window.requestAnimationFrame(() => menuButtonRef.current?.focus());
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [menuOpen]);

  return (
    <header className={`site-header${scrolled ? " site-header-scrolled" : ""}`}>
      <div className="header-inner">
        <a href="#home" className="brand" onClick={closeMenu} aria-label={company.logo.alt[language]}>
          <span className="brand-mark">{company.logo.mark}</span>
          <span className="brand-copy"><strong>{company.name}</strong><small>{company.nameZh}</small></span>
        </a>
        <button type="button" ref={menuButtonRef} className="mobile-menu-button" onClick={() => setMenuOpen((open) => !open)} aria-expanded={menuOpen} aria-controls="mobile-navigation" aria-label={menuOpen ? (language === "zh" ? "关闭导航菜单" : "Close navigation menu") : (language === "zh" ? "打开导航菜单" : "Open navigation menu")}><span /><span /></button>
        <div id="mobile-navigation" className={`nav-panel ${menuOpen ? "nav-panel-open" : ""}`}>
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
