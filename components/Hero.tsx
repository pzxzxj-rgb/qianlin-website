import { company } from "../data/siteConfig";
import { useLanguage } from "./LanguageContext";

type HeroProps = { onCustomize: () => void };

export function Hero({ onCustomize }: HeroProps) {
  const { t } = useLanguage();
  return (
    <section id="home" className="hero-section">
      <div className="hero-image" style={{ backgroundImage: `url("${company.images.hero}")` }} aria-hidden="true" /><div className="hero-overlay" aria-hidden="true" />
      <div className="container hero-content">
        <p className="hero-kicker"><span /> {t.hero.kicker}</p>
        <h1>{t.hero.title}<br /><em>{t.hero.accent}</em></h1>
        <p className="hero-description">{t.hero.description}</p>
        <p className="hero-chinese">{t.hero.chinese}</p>
        <div className="hero-actions"><a className="button button-light" href="#tours">{t.hero.explore} <span aria-hidden="true">↗</span></a><button type="button" className="button button-ghost" onClick={onCustomize}>{t.hero.customize} <span aria-hidden="true">↗</span></button></div>
      </div>
      <div className="hero-scroll-hint" aria-hidden="true"><span /> {t.hero.scroll}</div>
      <div className="hero-location" aria-hidden="true"><span>26° 34′ N</span><span>106° 43′ E</span></div>
    </section>
  );
}
