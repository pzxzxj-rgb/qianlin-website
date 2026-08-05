import type { Metadata } from "next";
import { LegalPage } from "../../components/LegalPage";
import { legalDocuments } from "../../data/legal";

export const metadata: Metadata = { title: "退款与取消政策", description: "网站退款与取消政策。", alternates: { canonical: "/refund" } };

export default function RefundPage() {
  return <LegalPage document={legalDocuments.refund} />;
}
