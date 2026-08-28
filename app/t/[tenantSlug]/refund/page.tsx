import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { LegalPage } from "../../../../components/LegalPage";
import { getTenantLegalDocument } from "../../../../lib/legal/tenantDocuments";
import { DEFAULT_TENANT_SLUG } from "../../../../lib/tenancy/resolveTenant";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}): Promise<Metadata> {
  const { tenantSlug } = await params;

  if (tenantSlug === DEFAULT_TENANT_SLUG) {
    return {
      title: "退款与取消政策",
      description: "网站退款与取消政策。",
      alternates: { canonical: "/refund" },
    };
  }

  const legal = await getTenantLegalDocument(tenantSlug, "refund");

  return {
    title: "退款与取消政策",
    description: `${tenantSlug} 退款与取消政策。`,
    alternates: {
      canonical: `/t/${encodeURIComponent(tenantSlug)}/refund`,
    },
    robots: legal?.isPublic
      ? undefined
      : { index: false, follow: false },
  };
}

export default async function TenantRefundPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;

  if (tenantSlug === DEFAULT_TENANT_SLUG) {
    redirect("/refund");
  }

  const legal = await getTenantLegalDocument(tenantSlug, "refund");

  if (!legal) notFound();

  return <LegalPage {...legal} />;
}
