"use client";

import type { FormEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { TenantSiteConfig } from "../lib/tenancy/types";
import { useLanguage } from "./LanguageContext";

type CustomizeFormProps = { open: boolean; initialTourName?: string; initialPlaces?: string; initialMessage?: string; onOpen: () => void; onClose: () => void; tenantSlug: string; siteConfig: TenantSiteConfig };

function getChinaDate() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).format(new Date());
}

export function CustomizeForm({ open, initialTourName = "", initialPlaces = "", initialMessage = "", onOpen, onClose, tenantSlug, siteConfig }: CustomizeFormProps) {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const { language, t } = useLanguage();
  const modalRef = useRef<HTMLDivElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const submittingRef = useRef(submitting);

  useEffect(() => {
    onCloseRef.current = onClose;
    submittingRef.current = submitting;
  }, [onClose, submitting]);

  const handleClose = useCallback(() => {
    if (submittingRef.current) return;
    setSubmitted(false);
    setSubmitError("");
    onCloseRef.current();
    window.requestAnimationFrame(() => previousFocusRef.current?.focus());
  }, []);

  useEffect(() => {
    document.body.classList.toggle("modal-open", open);
    if (!open) return () => document.body.classList.remove("modal-open");

    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusTimer = window.setTimeout(() => firstInputRef.current?.focus(), 0);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        handleClose();
        return;
      }
      if (event.key !== "Tab" || !modalRef.current) return;
      const focusable = Array.from(modalRef.current.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]"));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.classList.remove("modal-open");
    };
  }, [open, handleClose]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setSubmitError("");

    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form).entries());
    const phone = typeof payload.phone === "string" ? payload.phone.replace(/[\s\-－–—]/g, "") : "";
    const travelDate = typeof payload.travelDate === "string" ? payload.travelDate : "";
    if (!/^1[3-9]\d{9}$/.test(phone) || (travelDate && travelDate < getChinaDate())) {
      setSubmitError(t.customize.submitError);
      setSubmitting(false);
      return;
    }

    try {
      const response = await fetch(`/api/t/${encodeURIComponent(tenantSlug)}/inquiries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        const serverMessage = language === "zh" ? result.errorZh : result.errorEn;
        throw new Error(typeof serverMessage === "string" ? serverMessage : t.customize.submitError);
      }
      setSubmitted(true);
      form.reset();
    } catch (error) {
      setSubmitError(error instanceof Error && error.message ? error.message : t.customize.submitError);
    } finally {
      setSubmitting(false);
    }
  };

  return <>
    <section id="customize" className="section section-customize"><div className="container customize-layout"><div className="customize-copy"><span className="eyebrow eyebrow-light">{t.customize.eyebrow}</span><h2>{t.customize.title}<br /><em>{t.customize.accent}</em></h2><p>{t.customize.description}</p><div className="customize-details">{t.customize.details.map((item) => <span key={item}>{item}</span>)}</div><button type="button" className="button button-light" onClick={onOpen}>{t.customize.button} <span aria-hidden="true">→</span></button></div><div className="customize-image-wrap">{siteConfig.profile.images.customize.src ? <img src={siteConfig.profile.images.customize.src} alt={siteConfig.profile.images.customize.alt[language]} loading="lazy" /> : null}<span className="image-caption">{t.customize.imageCaption}<br /><em>{t.customize.imageChinese}</em></span></div></div></section>
    {open ? <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) handleClose(); }}><div ref={modalRef} className="customize-modal" role="dialog" aria-modal="true" aria-labelledby="customize-modal-title" aria-describedby="customize-modal-description"><div className="modal-header"><div><span className="eyebrow">{t.customize.modalEyebrow}</span><h2 id="customize-modal-title">{t.customize.modalTitle}</h2><p id="customize-modal-description" className="modal-description">{t.customize.modalDescription}</p></div><button type="button" className="modal-close" onClick={handleClose} aria-label={t.customize.close}>×</button></div>{submitted ? <div className="success-state"><span className="success-mark" aria-hidden="true">✓</span><h3>{t.customize.success}</h3><p>{t.customize.successCopy}</p><button type="button" className="button button-dark" onClick={handleClose}>{t.customize.back}</button></div> : <form className="customize-form" onSubmit={handleSubmit} key={`${initialTourName}|${initialPlaces}|${initialMessage}`}><div className="form-grid"><label htmlFor="inquiry-name">{t.customize.fields.name}<input ref={firstInputRef} id="inquiry-name" name="name" placeholder={t.customize.placeholders.name} autoComplete="name" maxLength={80} required /></label><label htmlFor="inquiry-phone">{t.customize.fields.phone}<input id="inquiry-phone" name="phone" placeholder={t.customize.placeholders.phone} autoComplete="tel" inputMode="tel" maxLength={20} required /></label><label htmlFor="inquiry-wechat">{t.customize.fields.wechat}<input id="inquiry-wechat" name="wechat" placeholder={t.customize.placeholders.wechat} maxLength={80} /></label><label htmlFor="inquiry-email">{t.customize.fields.email}<input id="inquiry-email" type="email" name="email" placeholder={t.customize.placeholders.email} autoComplete="email" maxLength={254} /></label><label htmlFor="inquiry-location">{t.customize.fields.location}<input id="inquiry-location" name="location" placeholder={t.customize.placeholders.location} maxLength={100} /></label><label htmlFor="inquiry-date">{t.customize.fields.date}<input id="inquiry-date" type="date" name="travelDate" min={getChinaDate()} /></label><label htmlFor="inquiry-travelers">{t.customize.fields.travelers}<select id="inquiry-travelers" name="travelers" defaultValue="" required><option value="" disabled>{t.customize.placeholders.travelers}</option><option value="1">{t.customize.travelerOptions[0]}</option><option value="2">{t.customize.travelerOptions[1]}</option><option value="3-5">{t.customize.travelerOptions[2]}</option><option value="6+">{t.customize.travelerOptions[3]}</option></select></label><label htmlFor="inquiry-duration">{t.customize.fields.duration}<select id="inquiry-duration" name="duration" defaultValue=""><option value="">{t.customize.placeholders.duration}</option><option value="3-4">{t.customize.durationOptions[0]}</option><option value="5-6">{t.customize.durationOptions[1]}</option><option value="7-10">{t.customize.durationOptions[2]}</option><option value="10+">{t.customize.durationOptions[3]}</option></select></label><label className="form-full" htmlFor="inquiry-tour-name">{t.customize.fields.tourName}<input id="inquiry-tour-name" name="tourName" defaultValue={initialTourName} placeholder={t.customize.placeholders.tourName} maxLength={160} /></label><label className="form-full" htmlFor="inquiry-places">{t.customize.fields.places}<input id="inquiry-places" name="places" defaultValue={initialPlaces} placeholder={t.customize.placeholders.places} maxLength={500} /></label><label className="form-full" htmlFor="inquiry-message">{t.customize.fields.message}<textarea id="inquiry-message" name="message" defaultValue={initialMessage} rows={4} placeholder={t.customize.placeholders.message} maxLength={2000} /></label></div><div className="honeypot-field" aria-hidden="true"><label htmlFor="inquiry-website">{t.customize.honeypotLabel}<input id="inquiry-website" name="website" tabIndex={-1} autoComplete="off" /></label></div><label className="privacy-consent" htmlFor="privacy-consent"><input id="privacy-consent" type="checkbox" name="privacyConsent" value="true" required /><span>{t.customize.privacyBefore}<a href="/privacy" target="_blank" rel="noreferrer">{t.customize.privacyLink}</a>{t.customize.privacyAfter}</span></label><div className="form-actions">{submitError ? <p className="form-error" role="alert">{submitError}</p> : <p>{t.customize.note}</p>}<button type="submit" className="button button-dark" disabled={submitting}>{submitting ? t.customize.submitting : t.customize.submit} <span aria-hidden="true">→</span></button></div></form>}</div></div> : null}
  </>;
}
