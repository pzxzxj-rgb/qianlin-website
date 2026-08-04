import type { Metadata } from "next";
import { LegalPage } from "../../components/LegalPage";
import { legalDocuments } from "../../data/legal";

export const metadata: Metadata = {
  title: "退款与取消政策 | 黔林旅行社",
  description: "黔林旅行社退款与取消政策。",
};

export default function RefundPolicyPage() {
  return <LegalPage document={legalDocuments.refund} />;
}
