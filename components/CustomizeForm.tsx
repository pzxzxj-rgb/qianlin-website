"use client";

import { FormEvent, useEffect, useState } from "react";
import { company } from "../data/siteConfig";
import { useLanguage } from "./LanguageContext";

type CustomizeFormProps = { open: boolean; onOpen: () => void; onClose: () => void };

export function CustomizeForm({ open, onOpen, onClose }: CustomizeFormProps) {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const { language, t } = useLanguage();
  const handleClose = () => { setSubmitted(false); setSubmitError(""); onClose(); };

  useEffect(() => { document.body.classList.toggle("modal-open", open); return () => document.body.classList.remove("modal-open"); }, [open]);
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setSubmitError("");

    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form).entries());

    try {
      const response = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(typeof result.error === "string" ? result.error : t.customize.submitError);
      }

      setSubmitted(true);
      form.reset();
    } catch {
      setSubmitError(t.customize.submitError);
    } finally {
      setSubmitting(false);
    }
  };

  return <>
    <section id="customize" className="section section-customize"><div className="container customize-layout"><div className="customize-copy"><span className="eyebrow eyebrow-light">{t.customize.eyebrow}</span><h2>{t.customize.title}<br /><em>{t.customize.accent}</em></h2><p>{t.customize.description}</p><div className="customize-details">{t.customize.details.map((item) => <span key={item}>{item}</span>)}</div><button type="button" className="button button-light" onClick={onOpen}>{t.customize.button} <span aria-hidden="true">↗</span></button></div><div className="customize-image-wrap"><img src={company.images.customize} alt={company.imageAlt.customize[language]} loading="lazy" /><span className="image-caption">{t.customize.imageCaption}<br /><em>{t.customize.imageChinese}</em></span></div></div></section>
    {open ? <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) handleClose(); }}><div className="customize-modal" role="dialog" aria-modal="true" aria-labelledby="customize-modal-title"><div className="modal-header"><div><span className="eyebrow">{t.customize.modalEyebrow}</span><h2 id="customize-modal-title">{t.customize.modalTitle}</h2></div><button type="button" className="modal-close" onClick={handleClose} aria-label={t.customize.close}>×</button></div>{submitted ? <div className="success-state"><span className="success-mark">✓</span><h3>{t.customize.success}</h3><p>{t.customize.successCopy}</p><button type="button" className="button button-dark" onClick={handleClose}>{t.customize.back}</button></div> : <form className="customize-form" onSubmit={handleSubmit}><div className="form-grid"><label>{t.customize.fields.name}<input name="name" placeholder={t.customize.placeholders.name} required /></label><label>{t.customize.fields.country}<input name="country" placeholder={t.customize.placeholders.country} required /></label><label>{t.customize.fields.email}<input type="email" name="email" placeholder={t.customize.placeholders.email} required /></label><label>{t.customize.fields.whatsapp}<input name="whatsapp" placeholder={t.customize.placeholders.whatsapp} /></label><label>{t.customize.fields.date}<input type="date" name="travelDate" /></label><label>{t.customize.fields.travelers}<select name="travelers" defaultValue=""><option value="" disabled>{t.customize.placeholders.travelers}</option>{t.customize.travelerOptions.map((option) => <option key={option}>{option}</option>)}</select></label><label>{t.customize.fields.duration}<select name="duration" defaultValue=""><option value="" disabled>{t.customize.placeholders.duration}</option>{t.customize.durationOptions.map((option) => <option key={option}>{option}</option>)}</select></label><label>{t.customize.fields.places}<input name="places" placeholder={t.customize.placeholders.places} /></label><label className="form-full">{t.customize.fields.message}<textarea name="message" rows={4} placeholder={t.customize.placeholders.message} /></label></div><div className="form-actions">{submitError ? <p className="form-error" role="alert">{submitError}</p> : <p>{t.customize.note}</p>}<button type="submit" className="button button-dark" disabled={submitting}>{submitting ? t.customize.submitting : t.customize.submit} <span aria-hidden="true">↗</span></button></div></form>}</div></div> : null}
  </>;
}
