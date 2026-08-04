import { company } from "../data/siteConfig";
import { useLanguage } from "./LanguageContext";
import { SectionHeading } from "./SectionHeading";

export function About() {
  const { language, t } = useLanguage();
  return <section id="about" className="section section-about"><div className="container about-layout"><div className="about-image-wrap"><img src={company.images.about} alt={company.imageAlt.about[language]} loading="lazy" /><span className="about-stamp">{company.logo.mark}<br /><small>{t.about.stamp}</small></span></div><div className="about-copy"><SectionHeading eyebrow={t.about.eyebrow} title={t.about.title} description={company.description[language]} /><p className="about-lead">{t.about.lead}</p><div className="about-services">{t.about.services.map((service) => <span key={service}>{service}</span>)}</div><a className="text-link" href="#contact">{t.about.link} <span aria-hidden="true">↗</span></a></div></div></section>;
}
