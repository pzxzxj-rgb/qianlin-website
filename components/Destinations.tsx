"use client";

import { useState } from "react";
import Image from "next/image";
import { useLanguage } from "./LanguageContext";
import { usePlannerOptions } from "./PlannerOptionsProvider";
import { SectionHeading } from "./SectionHeading";

type DestinationsProps = { onSelectDestination: (destinationName: string) => void };

export function Destinations({ onSelectDestination }: DestinationsProps) {
  const { language, t } = useLanguage();
  const { status, destinations, error, retry } = usePlannerOptions();
  const [failedImageIds, setFailedImageIds] = useState<string[]>([]);
  const homepageDestinations = destinations.filter((destination) => destination.showOnHomepage).sort((left, right) => left.displayOrder - right.displayOrder || left.id.localeCompare(right.id));

  if (status === "idle" || status === "loading") return <section id="destinations" className="section section-destinations"><div className="container"><SectionHeading eyebrow={t.destinations.eyebrow} title={t.destinations.title} description={t.destinations.description} /><p className="planner-loading">{t.planner.loading}</p></div></section>;
  if (status === "error") return <section id="destinations" className="section section-destinations"><div className="container"><SectionHeading eyebrow={t.destinations.eyebrow} title={t.destinations.title} description={t.destinations.description} /><div className="planner-load-state"><p role="alert">{error}</p><button type="button" className="text-link" onClick={retry}>{t.planner.retry}</button></div></div></section>;
  if (homepageDestinations.length === 0) return null;

  const total = String(homepageDestinations.length).padStart(2, "0");
  const markImageFailed = (id: string) => setFailedImageIds((current) => current.includes(id) ? current : [...current, id]);
  return <section id="destinations" className="section section-destinations">
    <div className="container">
      <div className="section-row section-row-start"><SectionHeading eyebrow={t.destinations.eyebrow} title={t.destinations.title} description={t.destinations.description} /><span className="section-side-note">01 · {total}<br /><span>{t.destinations.selected}</span></span></div>
      <div className="destination-grid">
        {homepageDestinations.map((destination, index) => {
          const name = destination.name[language];
          const cardClass = `destination-card destination-card-${destination.cardSize}`;
          const ariaLabel = language === "zh" ? `咨询${name}` : `Enquire about ${name}`;
          const imageAvailable = destination.imageUrl.trim().length > 0 && !failedImageIds.includes(destination.id);
          return <button type="button" className={cardClass} key={destination.id} onClick={() => onSelectDestination(name)} aria-label={ariaLabel}>{imageAvailable ? <Image src={destination.imageUrl} alt={name} width={960} height={640} sizes="(max-width: 760px) 50vw, 25vw" loading="lazy" onError={() => markImageFailed(destination.id)} /> : <div className="destination-image-fallback" aria-hidden="true"><span>{String(index + 1).padStart(2, "0")}</span></div>}<div className="destination-shade" /><div className="destination-copy"><span className="destination-index">0{index + 1}</span><h3>{name}</h3><p>{destination.description[language]}</p></div><span className="destination-arrow" aria-hidden="true">↗</span></button>;
        })}
      </div>
    </div>
  </section>;
}
