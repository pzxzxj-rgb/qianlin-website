import type { Metadata } from "next";
import { LegalPage } from "../../components/LegalPage";
import { createLegalDocuments } from "../../data/legal";
import { getCurrentLegalCompany } from "../../lib/legal/company";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export const metadata: Metadata = { title: "用户服务条款", description: "网站用户服务条款。", alternates: { canonical: "/terms" } };

export default async function TermsPage() {
  const company = await getCurrentLegalCompany();
  return <LegalPage document={createLegalDocuments(company).terms} company={company} />;
}
