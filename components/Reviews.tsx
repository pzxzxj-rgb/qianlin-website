import { useLanguage } from "./LanguageContext";

export function Reviews() {
  const { t } = useLanguage();
  return <section id="reviews" className="section section-reviews"><div className="container"><div className="reviews-heading"><span className="eyebrow">{t.reviews.eyebrow}</span><h2>{t.reviews.title}</h2><p>{t.reviews.description}</p></div><div className="reviews-grid">{[0, 1, 2].map((index) => <article className="review-card" key={index}><span className="quote-mark">“</span><p>{t.reviews.quote}</p><div className="review-footer"><span>{t.reviews.detail}</span><span>0{index + 1}</span></div></article>)}</div></div></section>;
}
