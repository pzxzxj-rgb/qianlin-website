import type { Tour } from "../types/tour";
import Image from "next/image";
import { useLanguage } from "./LanguageContext";
import { SectionHeading } from "./SectionHeading";

type ToursProps = {
  tours: readonly Tour[];
  onBook: (tourName: string) => void;
  region?: {
    zh: string;
    en: string;
  };
};

export function Tours({
  tours,
  onBook,
  region,
}: ToursProps) {
  const { language, t } = useLanguage();

  return (
    <section
      id="tours"
      className="section section-tours"
    >
      <div className="container">
        <div className="section-row section-row-start">
          <SectionHeading
            eyebrow={t.tours.eyebrow}
            title={t.tours.title}
            description={t.tours.description}
          />

          <a
            href="#customize"
            className="text-link"
          >
            {t.tours.seeAll}
            <span aria-hidden="true">→</span>
          </a>
        </div>

        <div className="tour-grid">
          {tours.map((tour, index) => {
            const title = tour.title[language];

            return (
              <article
                className="tour-card"
                key={tour.id}
              >
                <div className="tour-image-wrap">
                  {tour.image ? (
                    <Image
                      src={tour.image}
                      alt={
                        tour.imageAlt?.[language] ??
                        title
                      }
                      className="tour-image"
                      width={960}
                      height={640}
                      sizes="(max-width: 760px) 100vw, 33vw"
                      loading="lazy"
                      onError={(event) => {
                        event.currentTarget.hidden =
                          true;
                      }}
                    />
                  ) : null}

                  {tour.tag ? (
                    <span className="tour-tag">
                      {tour.tag[language]}
                    </span>
                  ) : null}

                  <span className="tour-number">
                    {String(index + 1).padStart(
                      2,
                      "0",
                    )}
                  </span>
                </div>

                <div className="tour-card-body">
                  {tour.duration ? (
                    <div className="tour-meta">
                      <span>
                        {tour.duration[language]}
                      </span>

                      <span className="meta-dot" />

                      <span>
                        {region?.[language] ||
                          t.tours.location}
                      </span>
                    </div>
                  ) : null}

                  <h3>{title}</h3>

                  <p>
                    {tour.description[language]}
                  </p>

                  <div className="tour-card-footer">
                    <span className="tour-flexible-label">
                      {t.tours.flexible}
                    </span>

                    <button
                      type="button"
                      className="card-link"
                      onClick={() =>
                        onBook(title)
                      }
                    >
                      {t.tours.details}
                      <span aria-hidden="true">
                        →
                      </span>
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        <p className="tour-price-note">
          {t.tours.priceNote}
        </p>
      </div>
    </section>
  );
}
