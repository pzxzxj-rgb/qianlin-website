import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LegalPage } from "../../components/LegalPage";
import { getTenantLegalDocument } from "../../lib/legal/tenantDocuments";
import { DEFAULT_TENANT_SLUG } from "../../lib/tenancy/resolveTenant";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export const metadata: Metadata = { title: "用户服务条款", description: "网站用户服务条款。", alternates: { canonical: "/terms" } };

export default async function TermsPage() {
  const legal = await getTenantLegalDocument(DEFAULT_TENANT_SLUG, "terms");
  if (!legal) notFound();
  return <LegalPage document={legal.document} company={legal.company} />;
}
