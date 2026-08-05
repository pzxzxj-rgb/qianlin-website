"use client";

import { useState } from "react";
import type { TenantSiteConfig } from "../lib/tenancy/types";
import { useLanguage } from "./LanguageContext";
import { SectionHeading } from "./SectionHeading";

type ContactProps = { onEnquire: () => void; siteConfig: TenantSiteConfig };

export function Contact({ onEnquire, siteConfig }: ContactProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState("");
  const { language, t } = useLanguage();

  const copyContact = async (key: string, value: string) => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      setCopyMessage(t.contact.copySuccess);
      window.setTimeout(() => setCopiedKey((current) => current === key ? null : current), 1800);
    } catch {
      setCopiedKey(null);
      setCopyMessage(t.contact.copyFailed);
    }
  };

  return <section id="contact" className="section section-contact"><div className="container contact-layout"><div><SectionHeading eyebrow={t.contact.eyebrow} title={t.contact.title} description={t.contact.description} /><button type="button" className="button button-dark" onClick={onEnquire}>{t.contact.button} <span aria-hidden="true">→</span></button></div><div className="contact-list">{siteConfig.contacts.map((channel) => { const copyLabel = channel.type === "email" ? t.contact.copyEmail : channel.type === "wechat" ? t.contact.copyWechat : null; return <div className="contact-item" key={channel.id}><span>{channel.label[language]}</span><div className="contact-value"><strong>{channel.href ? <a href={channel.href}>{channel.value}</a> : channel.value}</strong>{copyLabel ? <button type="button" className="contact-copy" onClick={() => copyContact(channel.type, channel.value)}>{copiedKey === channel.type ? t.contact.copied : copyLabel}</button> : null}</div></div>; })}{siteConfig.profile.address[language] ? <div className="contact-item contact-item-address"><span>{t.contact.addressLabel}</span><strong>{siteConfig.profile.address[language]}</strong></div> : null}<p className="sr-only" aria-live="polite" aria-atomic="true">{copyMessage}</p></div></div></section>;
}
