import type { Tour } from "../data/tours";
import { useLanguage } from "./LanguageContext";
import { SectionHeading } from "./SectionHeading";

type ToursProps = { tours: Tour[]; onBook: (tourName: string) => void };

export function Tours({ tours, onBook }: ToursProps) {
  const { language, t } = useLanguage();

  return (
    <section id="tours" className="section section-tours">
      <div className="container">
        <div className="section-row section-row-start">
          <SectionHeading eyebrow={t.tours.eyebrow} title={t.tours.title} description={t.tours.description} />
          <a href="#customize" className="text-link">{t.tours.seeAll} <span aria-hidden="true">→</span></a>
        </div>
        <div className="tour-grid">
          {tours.map((tour, index) => {
            const title = language === "zh" ? tour.titleZh : tour.title;
            return <article className="tour-card" key={tour.title}>
              <div className="tour-image-wrap"><img src={tour.image} alt={title} className="tour-image" loading={index > 1 ? "lazy" : "eager"} /><span className="tour-tag">{language === "zh" ? tour.tagZh : tour.tag}</span><span className="tour-number">0{index + 1}</span></div>
              <div className="tour-card-body"><div className="tour-meta"><span>{language === "zh" ? tour.durationZh : tour.duration}</span><span className="meta-dot" /><span>{t.tours.location}</span></div><h3>{title}</h3><p>{language === "zh" ? tour.descriptionZh : tour.description}</p><div className="tour-card-footer"><strong>{tour.price}</strong><button type="button" className="card-link" onClick={() => onBook(title)}>{t.tours.details} <span aria-hidden="true">→</span></button></div></div>
            </article>;
          })}
        </div>
        <p className="tour-price-note">{t.tours.priceNote}</p>
      </div>
    </section>
  );
}
