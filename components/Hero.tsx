"use client";

import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { company } from "../data/siteConfig";
import { useLanguage } from "./LanguageContext";

const AUTO_ADVANCE_MS = 6000;

type HeroProps = { onCustomize: () => void };

export function Hero({ onCustomize }: HeroProps) {
  const { language, t } = useLanguage();
  const [activeIndex, setActiveIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [isControlFocused, setIsControlFocused] = useState(false);
  const [isDocumentHidden, setIsDocumentHidden] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const slides = company.heroSlides;
  const isPaused = isHovered || isControlFocused || isDocumentHidden || prefersReducedMotion;

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotionPreference = () => setPrefersReducedMotion(mediaQuery.matches);
    const updateDocumentVisibility = () => setIsDocumentHidden(document.visibilityState === "hidden");
    updateMotionPreference();
    updateDocumentVisibility();
    mediaQuery.addEventListener("change", updateMotionPreference);
    document.addEventListener("visibilitychange", updateDocumentVisibility);
    return () => {
      mediaQuery.removeEventListener("change", updateMotionPreference);
      document.removeEventListener("visibilitychange", updateDocumentVisibility);
    };
  }, []);

  useEffect(() => {
    if (isPaused || slides.length < 2) return;
    const timer = window.setTimeout(() => setActiveIndex((current) => (current + 1) % slides.length), AUTO_ADVANCE_MS);
    return () => window.clearTimeout(timer);
  }, [activeIndex, isPaused, slides.length]);

  const goToSlide = (index: number) => setActiveIndex((index + slides.length) % slides.length);
  const moveSlide = (direction: 1 | -1) => setActiveIndex((current) => (current + direction + slides.length) % slides.length);

  return (
    <section id="home" className="hero-section" onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
      <div className="hero-slides">
        {slides.map((slide, index) => <div className={`hero-slide${activeIndex === index ? " hero-slide-active" : ""}`} key={slide.src} style={{ "--hero-desktop-position": slide.desktopPosition, "--hero-mobile-position": slide.mobilePosition } as CSSProperties}><img src={slide.src} alt={slide.alt[language]} aria-hidden={activeIndex !== index} loading={index === 0 ? "eager" : "lazy"} fetchPriority={index === 0 ? "high" : "low"} /></div>)}
      </div>
      <div className="hero-overlay" aria-hidden="true" />
      <div className="container hero-content">
        <p className="hero-kicker"><span /> {t.hero.kicker}</p>
        <h1>{t.hero.title}<br /><em>{t.hero.accent}</em></h1>
        <p className="hero-description">{t.hero.description}</p>
        <p className="hero-chinese">{t.hero.chinese}</p>
        <div className="hero-actions"><a className="button button-light" href="#tours">{t.hero.explore} <span aria-hidden="true">↗</span></a><button type="button" className="button button-ghost" onClick={onCustomize}>{t.hero.customize} <span aria-hidden="true">↗</span></button></div>
      </div>
      <div className="hero-scroll-hint" aria-hidden="true"><span /> {t.hero.scroll}</div>
      <div className="hero-location" aria-hidden="true"><span>26° 34′ N</span><span>106° 43′ E</span></div>
      <div className="hero-carousel-controls" aria-label={language === "zh" ? "首页图片轮播控制" : "Hero image carousel controls"} onFocus={() => setIsControlFocused(true)} onBlur={(event) => { if (!event.relatedTarget || !event.currentTarget.contains(event.relatedTarget as Node)) setIsControlFocused(false); }}>
        <button type="button" className="hero-carousel-arrow" onClick={() => moveSlide(-1)} aria-label={t.hero.previous}><span aria-hidden="true">←</span></button>
        <div className="hero-carousel-dots">{slides.map((slide, index) => <button type="button" className={`hero-carousel-dot${activeIndex === index ? " hero-carousel-dot-active" : ""}`} key={slide.src} onClick={() => goToSlide(index)} aria-label={language === "zh" ? `${t.hero.slide}${index + 1}张首页图片` : `${t.hero.slide} ${index + 1}`} aria-current={activeIndex === index ? "true" : undefined} />)}</div>
        <button type="button" className="hero-carousel-arrow" onClick={() => moveSlide(1)} aria-label={t.hero.next}><span aria-hidden="true">→</span></button>
      </div>
    </section>
  );
}
