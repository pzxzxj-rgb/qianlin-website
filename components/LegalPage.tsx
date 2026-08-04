import Link from "next/link";
import type { LegalDocument, LegalSection } from "../data/legal";
import { company } from "../data/siteConfig";

function LegalSectionView({ section, depth = 2 }: { section: LegalSection; depth?: number }) {
  const Heading = depth > 2 ? "h3" : "h2";
  return <section className={`legal-section legal-section-depth-${depth}`}><Heading>{section.heading}</Heading>{section.paragraphs?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}{section.items ? <ul>{section.items.map((item) => <li key={item}>{item}</li>)}</ul> : null}{section.subsections?.map((subsection) => <LegalSectionView key={subsection.heading} section={subsection} depth={depth + 1} />)}</section>;
}

export function LegalPage({ document }: { document: LegalDocument }) {
  const email = company.contact.channels.find((channel) => channel.key === "email")?.value ?? "";
  return <main className="legal-page" lang="zh-CN"><div className="legal-container"><header className="legal-header"><Link href="/" className="brand legal-brand"><span className="brand-mark">{company.logo.mark}</span><span className="brand-copy"><strong>{company.name}</strong><small>{company.nameZh}</small></span></Link><Link href="/" className="legal-back-link">返回官网</Link></header><article className="legal-document"><p className="legal-eyebrow">{company.nameZh} · 官方政策</p><h1>{document.title}</h1><p className="legal-date">生效日期：{document.effectiveDate}</p>{document.intro ? <p className="legal-intro">{document.intro}</p> : null}{document.sections.map((section) => <LegalSectionView key={section.heading} section={section} />)}</article><footer className="legal-footer"><span>{company.nameZh}</span><a href={`mailto:${email}`}>{email}</a><Link href="/">返回官网</Link></footer></div></main>;
}
