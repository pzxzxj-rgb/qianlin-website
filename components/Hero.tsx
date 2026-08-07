"use client";

import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import type { TenantSiteConfig } from "../lib/tenancy/types";
import { useLanguage } from "./LanguageContext";

const AUTO_ADVANCE_MS = 6000;

type HeroProps = {
  showTours: boolean;
  onCustomize: () => void;
  slides: TenantSiteConfig["heroSlides"];
  region?: { zh: string; en: string };
  demoName?: { zh: string; en: string };
  demoDescription?: { zh: string; en: string };
  showCustomizeAction?: boolean;
};

export function Hero({ showTours, onCustomize, slides, region, demoName, demoDescription, showCustomizeAction = true }: HeroProps) {
  const { language, t } = useLanguage();
  const [activeIndex, setActiveIndex] = useState(0);
  const [failedSlideIds, setFailedSlideIds] = useState<string[]>([]);
  const [isHovered, setIsHovered] = useState(false);
  const [isControlFocused, setIsControlFocused] = useState(false);
  const [isDocumentHidden, setIsDocumentHidden] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const visibleSlides = slides.filter((slide) => !failedSlideIds.includes(slide.id));
  const visibleIndex = visibleSlides.length > 0 ? Math.min(activeIndex, visibleSlides.length - 1) : 0;
  const isPaused = isHovered || isControlFocused || isDocumentHidden || prefersReducedMotion;
  const isDemo = Boolean(demoName);

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
    if (isPaused || visibleSlides.length < 2) return;
    const timer = window.setTimeout(() => setActiveIndex((current) => (current + 1) % visibleSlides.length), AUTO_ADVANCE_MS);
    return () => window.clearTimeout(timer);
  }, [activeIndex, isPaused, visibleSlides.length]);

  const markSlideFailed = (slideId: string) => setFailedSlideIds((current) => current.includes(slideId) ? current : [...current, slideId]);
  const goToSlide = (index: number) => setActiveIndex((index + visibleSlides.length) % visibleSlides.length);
  const moveSlide = (direction: 1 | -1) => setActiveIndex((current) => (current + direction + visibleSlides.length) % visibleSlides.length);

  return <section id="home" className="hero-section" onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
    <div className="hero-slides">
      {visibleSlides.length === 0 ? <p className="hero-empty-state" role="status">{t.hero.empty}</p> : visibleSlides.map((slide, index) => <div className={`hero-slide${visibleIndex === index ? " hero-slide-active" : ""}`} key={slide.id} style={{ "--hero-desktop-position": slide.desktopPosition, "--hero-mobile-position": slide.mobilePosition } as CSSProperties}><img src={slide.src} alt={visibleIndex === index ? slide.alt[language] : ""} aria-hidden={visibleIndex === index ? undefined : true} width={1920} height={1080} sizes="100vw" loading={index === 0 ? "eager" : "lazy"} fetchPriority={index === 0 ? "high" : "low"} onError={() => markSlideFailed(slide.id)} /></div>)}
    </div>
    <div className="hero-overlay" aria-hidden="true" />
    <div className="container hero-content">
      <p className="hero-kicker"><span /> {region?.[language] ? `${t.hero.kicker} · ${region[language]}` : t.hero.kicker}</p>
      <h1>{isDemo ? demoName?.[language] : t.hero.title}<br />{isDemo ? null : <em>{t.hero.accent}</em>}</h1>
      <p className="hero-description">{isDemo ? demoDescription?.[language] : t.hero.description}</p>
      <p className="hero-chinese">{isDemo ? "" : t.hero.chinese}</p>
      <div className="hero-actions">{showTours ? <a className="button button-light" href="#tours">{t.hero.explore} <span aria-hidden="true">→</span></a> : null}{showCustomizeAction ? <button type="button" className="button button-ghost" onClick={onCustomize}>{t.hero.customize} <span aria-hidden="true">→</span></button> : null}</div>
    </div>
    <div className="hero-scroll-hint" aria-hidden="true"><span /> {t.hero.scroll}</div>
    {visibleSlides.length > 0 ? <div className="hero-carousel-controls" role="group" aria-label={language === "zh" ? "首页图片轮播控制" : "Hero image carousel controls"} onFocus={() => setIsControlFocused(true)} onBlur={(event) => { if (!event.relatedTarget || !event.currentTarget.contains(event.relatedTarget as Node)) setIsControlFocused(false); }}>
      <button type="button" className="hero-carousel-arrow" onClick={() => moveSlide(-1)} aria-label={t.hero.previous}><span aria-hidden="true">←</span></button>
      <div className="hero-carousel-dots">{visibleSlides.map((slide, index) => <button type="button" className={`hero-carousel-dot${visibleIndex === index ? " hero-carousel-dot-active" : ""}`} key={slide.id} onClick={() => goToSlide(index)} aria-label={language === "zh" ? `切换到第${index + 1}张首页图片` : `Show hero image ${index + 1}`} aria-current={visibleIndex === index ? "true" : undefined} />)}</div>
      <button type="button" className="hero-carousel-arrow" onClick={() => moveSlide(1)} aria-label={t.hero.next}><span aria-hidden="true">→</span></button>
    </div> : null}
  </section>;
}
