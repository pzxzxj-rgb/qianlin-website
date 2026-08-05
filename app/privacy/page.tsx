import type { Metadata } from "next";
import { LegalPage } from "../../components/LegalPage";
import { createLegalDocuments } from "../../data/legal";
import { getCurrentLegalCompany } from "../../lib/legal/company";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export const metadata: Metadata = { title: "隐私政策", description: "网站隐私政策。", alternates: { canonical: "/privacy" } };

export default async function PrivacyPolicyPage() {
  const company = await getCurrentLegalCompany();
  return <LegalPage document={createLegalDocuments(company).privacy} company={company} />;
}
