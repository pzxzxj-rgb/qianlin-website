"use client";

import { useState } from "react";
import { company } from "../data/siteConfig";
import { useLanguage } from "./LanguageContext";
import { SectionHeading } from "./SectionHeading";

export function Contact() {
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

  return <section id="contact" className="section section-contact"><div className="container contact-layout"><div><SectionHeading eyebrow={t.contact.eyebrow} title={t.contact.title} description={t.contact.description} /><a href="#customize" className="button button-dark">{t.contact.button} <span aria-hidden="true">→</span></a></div><div className="contact-list">{company.contact.channels.map((channel) => { const copyLabel = channel.key === "email" ? t.contact.copyEmail : channel.key === "wechat" ? t.contact.copyWechat : null; return <div className="contact-item" key={channel.key}><span>{channel.label[language]}</span><div className="contact-value"><strong>{channel.href ? <a href={channel.href}>{channel.value}</a> : channel.value}</strong>{copyLabel ? <button type="button" className="contact-copy" onClick={() => copyContact(channel.key, channel.value)}>{copiedKey === channel.key ? t.contact.copied : copyLabel}</button> : null}</div></div>; })}<div className="contact-item contact-item-address"><span>{t.contact.addressLabel}</span><strong>{company.address}</strong></div><p className="sr-only" aria-live="polite" aria-atomic="true">{copyMessage}</p></div></div></section>;
}
