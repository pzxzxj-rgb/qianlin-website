import type { Metadata } from "next";
import { LegalPage } from "../../components/LegalPage";
import { createLegalDocuments } from "../../data/legal";
import { getCurrentLegalCompany } from "../../lib/legal/company";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export const metadata: Metadata = { title: "退款与取消政策", description: "网站退款与取消政策。", alternates: { canonical: "/refund" } };

export default async function RefundPage() {
  const company = await getCurrentLegalCompany();
  return <LegalPage document={createLegalDocuments(company).refund} company={company} />;
}
