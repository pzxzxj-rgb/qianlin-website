import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LegalPage } from "../../components/LegalPage";
import { getTenantLegalDocument } from "../../lib/legal/tenantDocuments";
import { DEFAULT_TENANT_SLUG } from "../../lib/tenancy/resolveTenant";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export const metadata: Metadata = { title: "隐私政策", description: "网站隐私政策。", alternates: { canonical: "/privacy" } };

export default async function PrivacyPolicyPage() {
  const legal = await getTenantLegalDocument(DEFAULT_TENANT_SLUG, "privacy");
  if (!legal) notFound();
  return <LegalPage document={legal.document} company={legal.company} />;
}
