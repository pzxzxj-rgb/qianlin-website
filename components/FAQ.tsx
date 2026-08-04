"use client";

import { useState } from "react";
import { faqItems } from "../data/faq";
import { useLanguage } from "./LanguageContext";
import { SectionHeading } from "./SectionHeading";

export function FAQ() {
  const [active, setActive] = useState<number | null>(0);
  const { language, t } = useLanguage();
  return <section id="faq" className="section section-faq"><div className="container faq-layout"><SectionHeading eyebrow={t.faq.eyebrow} title={t.faq.title} description={t.faq.description} /><div className="faq-list">{faqItems.map((item, index) => { const isActive = active === index; return <div className={`faq-item ${isActive ? "faq-item-active" : ""}`} key={item.question}><button type="button" className="faq-question" onClick={() => setActive(isActive ? null : index)} aria-expanded={isActive}><span>{language === "zh" ? item.questionZh : item.question}</span><span className="faq-toggle">{isActive ? "−" : "+"}</span></button>{isActive ? <p className="faq-answer">{language === "zh" ? item.answerZh : item.answer}</p> : null}</div>; })}</div></div></section>;
}
