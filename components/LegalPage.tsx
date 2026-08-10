import Link from "next/link";
import type { LegalCompanyProfile, LegalDocument, LegalSection } from "../data/legal";

function LegalSectionView({ section, depth = 2 }: { section: LegalSection; depth?: number }) {
  const Heading = depth > 2 ? "h3" : "h2";
  return <section className={`legal-section legal-section-depth-${depth}`}><Heading>{section.heading}</Heading>{section.paragraphs?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}{section.items ? <ul>{section.items.map((item) => <li key={item}>{item}</li>)}</ul> : null}{section.subsections?.map((subsection) => <LegalSectionView key={subsection.heading} section={subsection} depth={depth + 1} />)}</section>;
}

export function LegalPage({ document, company, homePath = "/" }: { document: LegalDocument; company: LegalCompanyProfile; homePath?: string }) {
  return <main className="legal-page" lang="zh-CN"><div className="legal-container"><header className="legal-header"><Link href={homePath} className="brand legal-brand"><span className="brand-mark">{company.logoMark}</span><span className="brand-copy"><strong>{company.companyNameEn}</strong><small>{company.companyNameZh}</small></span></Link><Link href={homePath} className="legal-back-link">返回官网</Link></header><article className="legal-document"><p className="legal-eyebrow">{company.companyNameZh} · 官方政策</p><h1>{document.title}</h1><p className="legal-date">政策版本：{document.effectiveDate}</p>{document.intro ? <p className="legal-intro">{document.intro}</p> : null}{document.sections.map((section) => <LegalSectionView key={section.heading} section={section} />)}</article><footer className="legal-footer"><span>{company.companyNameZh}</span>{company.email ? <a href={`mailto:${company.email}`}>{company.email}</a> : null}<Link href={homePath}>返回官网</Link></footer></div></main>;
}
