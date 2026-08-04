import type { Metadata } from "next";
import { LegalPage } from "../../components/LegalPage";
import { legalDocuments } from "../../data/legal";

export const metadata: Metadata = { title: "隐私政策 | 黔林旅行社", description: "黔林旅行社隐私政策。", alternates: { canonical: "/privacy" } };

export default function PrivacyPolicyPage() {
  return <LegalPage document={legalDocuments.privacy} />;
}
