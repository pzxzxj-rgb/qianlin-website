import type { Metadata } from "next";
import { LegalPage } from "../../components/LegalPage";
import { legalDocuments } from "../../data/legal";

export const metadata: Metadata = {
  title: "用户服务条款 | 黔林旅行社",
  description: "黔林旅行社用户服务条款。",
};

export default function TermsPage() {
  return <LegalPage document={legalDocuments.terms} />;
}
