import { useLanguage } from "./LanguageContext";
import { company } from "../data/siteConfig";

export function Footer() {
  const { t } = useLanguage();
  return <footer className="site-footer"><div className="container footer-top"><div className="footer-brand"><a href="#home" className="brand brand-footer"><span className="brand-mark">{company.logo.mark}</span><span className="brand-copy"><strong>{company.name}</strong><small>{company.nameZh}</small></span></a><p>{t.footer.copy}<br />{t.footer.copyTwo}</p></div><div className="footer-links"><div><span className="footer-label">{t.footer.explore}</span><a href="#destinations">{t.footer.destinations}</a><a href="#tours">{t.footer.tours}</a><a href="#customize">{t.footer.customize}</a></div><div><span className="footer-label">{t.footer.company}</span><a href="#about">{t.footer.about}</a><a href="#contact">{t.footer.contact}</a><a href="#faq">{t.footer.faq}</a></div><div><span className="footer-label">{t.footer.policies}</span><a href="/privacy">{t.footer.privacy}</a><a href="/terms">{t.footer.terms}</a><a href="/refund">{t.footer.refund}</a></div></div></div><div className="container footer-bottom"><span>{t.footer.icp}</span><span>{t.footer.copyright}</span><a href="#home">{t.footer.top}</a></div></footer>;
}
