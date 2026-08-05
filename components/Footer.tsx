import { useLanguage } from "./LanguageContext";
import type { TenantSiteConfig } from "../lib/tenancy/types";

type FooterProps = { showTours: boolean; siteConfig: TenantSiteConfig };

export function Footer({ showTours, siteConfig }: FooterProps) {
  const { t } = useLanguage();
  const isDemo = siteConfig.tenant.isDemo;
  const copy = isDemo ? t.footer.demoCopy : t.footer.copy;
  const copyTwo = isDemo ? t.footer.demoCopyTwo : t.footer.copyTwo;
  const copyright = isDemo ? t.footer.demoCopyright : `${t.footer.copyright} ${siteConfig.profile.companyName.en}`;
  const companyLabel = t.footer.company;
  return <footer className="site-footer"><div className="container footer-top"><div className="footer-brand"><a href="#home" className="brand brand-footer"><span className="brand-mark">{siteConfig.profile.logo.mark}</span><span className="brand-copy"><strong>{siteConfig.profile.companyName.en}</strong><small>{siteConfig.profile.companyName.zh}</small></span></a><p>{copy}<br />{copyTwo}</p></div><div className="footer-links"><div><span className="footer-label">{t.footer.explore}</span>{isDemo ? <a href="#about">{t.footer.about}</a> : <><a href="#destinations">{t.footer.destinations}</a>{showTours ? <a href="#tours">{t.footer.tours}</a> : null}<a href="#customize">{t.footer.customize}</a></>}</div><div><span className="footer-label">{companyLabel}</span><a href="#about">{t.footer.about}</a>{isDemo ? null : <><a href="#contact">{t.footer.contact}</a><a href="#faq">{t.footer.faq}</a></>}</div><div><span className="footer-label">{t.footer.policies}</span><a href="/privacy">{t.footer.privacy}</a><a href="/terms">{t.footer.terms}</a><a href="/refund">{t.footer.refund}</a></div></div></div><div className="container footer-bottom">{t.footer.icp ? <span>{t.footer.icp}</span> : null}<span>{copyright}</span><a href="#home">{t.footer.top}</a></div></footer>;
}
