import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LegalPage } from "../../../../components/LegalPage";
import { getTenantLegalDocument } from "../../../../lib/legal/tenantDocuments";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function generateMetadata({ params }: { params: Promise<{ tenantSlug: string }> }): Promise<Metadata> {
  const { tenantSlug } = await params;
  const legal = await getTenantLegalDocument(tenantSlug, "privacy");
  return { title: "隐私政策", description: `${tenantSlug} 隐私政策。`, alternates: { canonical: `/t/${encodeURIComponent(tenantSlug)}/privacy` }, robots: legal?.isPublic ? undefined : { index: false, follow: false } };
}

export default async function TenantPrivacyPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;
  const legal = await getTenantLegalDocument(tenantSlug, "privacy");
  if (!legal) notFound();
  return <LegalPage {...legal} />;
}
