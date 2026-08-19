import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LegalPage } from "../../components/LegalPage";
import { getTenantLegalDocument } from "../../lib/legal/tenantDocuments";
import { DEFAULT_TENANT_SLUG } from "../../lib/tenancy/resolveTenant";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export const metadata: Metadata = { title: "退款与取消政策", description: "网站退款与取消政策。", alternates: { canonical: "/refund" } };

export default async function RefundPage() {
  const legal = await getTenantLegalDocument(DEFAULT_TENANT_SLUG, "refund");
  if (!legal) notFound();
  return <LegalPage document={legal.document} company={legal.company} />;
}
