import { company } from "../data/siteConfig";
import { useLanguage } from "./LanguageContext";
import { SectionHeading } from "./SectionHeading";

export function Contact() {
  const { language, t } = useLanguage();
  return <section id="contact" className="section section-contact"><div className="container contact-layout"><div><SectionHeading eyebrow={t.contact.eyebrow} title={t.contact.title} description={t.contact.description} /><a href="#customize" className="button button-dark">{t.contact.button} <span aria-hidden="true">↗</span></a></div><div className="contact-list">{company.contact.channels.map((channel) => <div className="contact-item" key={channel.key}><span>{channel.label[language]}</span><strong>{channel.href ? <a href={channel.href}>{channel.value}</a> : channel.value}</strong><small>{t.contact.sample}</small></div>)}</div></div></section>;
}
