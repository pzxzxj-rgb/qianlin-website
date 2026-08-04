import { useLanguage } from "./LanguageContext";
import { SectionHeading } from "./SectionHeading";

const icons = ["✦", "⌁", "◎", "✓"];

export function Services() {
  const { t } = useLanguage();
  return <section className="section section-services"><div className="container"><div className="section-row section-row-start"><SectionHeading eyebrow={t.services.eyebrow} title={t.services.title} description={t.services.description} /><span className="section-side-note section-side-note-dark">{t.services.side}<br /><span>{t.services.sideSub}</span></span></div><div className="benefits-grid">{t.services.items.map((benefit, index) => <article className="benefit-card" key={benefit.title}><div className="benefit-topline"><span className="benefit-icon">{icons[index]}</span><span>0{index + 1}</span></div><h3>{benefit.title}</h3><p>{benefit.copy}</p></article>)}</div></div></section>;
}
