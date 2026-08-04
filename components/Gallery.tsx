import { company } from "../data/siteConfig";
import { useLanguage } from "./LanguageContext";
import { SectionHeading } from "./SectionHeading";

export function Gallery() {
  const { t } = useLanguage();
  return <section id="gallery" className="section section-gallery"><div className="container"><div className="section-row section-row-start"><SectionHeading eyebrow={t.gallery.eyebrow} title={t.gallery.title} description={t.gallery.description} /><span className="section-side-note">{t.gallery.side}<br /><span>{t.gallery.sideSub}</span></span></div><div className="gallery-grid">{company.images.gallery.map((image, index) => <figure className={`gallery-item gallery-item-${index + 1}`} key={t.gallery.labels[index]}><img src={image} alt={t.gallery.labels[index]} loading="lazy" /><figcaption>{t.gallery.labels[index]}<span aria-hidden="true">↗</span></figcaption></figure>)}</div></div></section>;
}
