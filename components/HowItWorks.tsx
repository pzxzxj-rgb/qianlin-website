import { useLanguage } from "./LanguageContext";
import { SectionHeading } from "./SectionHeading";

export function HowItWorks() {
  const { t } = useLanguage();
  return <section id="process" className="section section-process"><div className="container"><SectionHeading eyebrow={t.process.eyebrow} title={t.process.title} description={t.process.description} /><div className="process-grid">{t.process.steps.map(([number, title, subtitle], index) => <div className="process-step" key={number}><div className="process-number">{number}</div><div className="process-line"><span /></div><h3>{title}</h3><p>{subtitle}</p>{index < t.process.steps.length - 1 ? <span className="process-arrow" aria-hidden="true">→</span> : null}</div>)}</div><div className="payment-note"><span className="payment-label">{t.process.paymentLabel}</span><div><strong>{t.process.paymentTitle}</strong><p>{t.process.paymentCopy}</p></div><span className="payment-status">{t.process.paymentStatus}</span></div></div></section>;
}
