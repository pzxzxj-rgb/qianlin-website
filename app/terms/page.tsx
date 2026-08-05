import type { Metadata } from "next";
import { LegalPage } from "../../components/LegalPage";
import { legalDocuments } from "../../data/legal";

export const metadata: Metadata = { title: "用户服务条款", description: "网站用户服务条款。", alternates: { canonical: "/terms" } };

export default function TermsPage() {
  return <LegalPage document={legalDocuments.terms} />;
}
