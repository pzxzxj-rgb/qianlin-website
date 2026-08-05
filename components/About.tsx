import type { TenantSiteConfig } from "../lib/tenancy/types";
import { useLanguage } from "./LanguageContext";
import { SectionHeading } from "./SectionHeading";

export function About({ siteConfig }: { siteConfig: TenantSiteConfig }) {
  const { language, t } = useLanguage();
  const title = siteConfig.tenant.isDemo ? siteConfig.profile.companyName[language] : t.about.title;
  return <section id="about" className="section section-about">
    <div className="container about-layout">
      <div className="about-image-wrap">
        {siteConfig.profile.images.about.src ? <img src={siteConfig.profile.images.about.src} alt={siteConfig.profile.images.about.alt[language]} loading="lazy" onError={(event) => { event.currentTarget.hidden = true; }} /> : null}
        <span className="about-stamp">{siteConfig.profile.logo.mark}<br /><small>{t.about.stamp}</small></span>
      </div>
      <div className="about-copy">
        <SectionHeading eyebrow={t.about.eyebrow} title={title} description={siteConfig.profile.description[language]} />
        <p className="about-lead">{t.about.lead}</p>
        {siteConfig.tenant.isDemo ? null : <><div className="about-services">{t.about.services.map((service) => <span key={service}>{service}</span>)}</div><a className="text-link" href="#contact">{t.about.link} <span aria-hidden="true">↗</span></a></>}
      </div>
    </div>
  </section>;
}
