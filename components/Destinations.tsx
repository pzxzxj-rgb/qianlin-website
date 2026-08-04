import type { Destination } from "../data/destinations";
import { useLanguage } from "./LanguageContext";
import { SectionHeading } from "./SectionHeading";

type DestinationsProps = { destinations: Destination[]; onSelectDestination: (destinationName: string) => void };

export function Destinations({ destinations, onSelectDestination }: DestinationsProps) {
  const { language, t } = useLanguage();
  const total = String(destinations.length).padStart(2, "0");
  return (
    <section id="destinations" className="section section-destinations">
      <div className="container">
        <div className="section-row section-row-start"><SectionHeading eyebrow={t.destinations.eyebrow} title={t.destinations.title} description={t.destinations.description} /><span className="section-side-note">01 — {total}<br /><span>{t.destinations.selected}</span></span></div>
        <div className="destination-grid">
          {destinations.map((destination, index) => { const name = language === "zh" ? destination.nameZh : destination.name; return <button type="button" className={`destination-card destination-card-${destination.size}`} key={destination.name} onClick={() => onSelectDestination(name)} aria-label={language === "zh" ? `咨询${name}` : `Enquire about ${name}`}><img src={destination.image} alt={name} loading={index > 1 ? "lazy" : "eager"} /><div className="destination-shade" /><div className="destination-copy"><span className="destination-index">0{index + 1}</span><h3>{name}</h3><p>{language === "zh" ? destination.descriptionZh : `${destination.chineseName} · ${destination.description}`}</p></div><span className="destination-arrow" aria-hidden="true">↗</span></button>; })}
        </div>
      </div>
    </section>
  );
}
