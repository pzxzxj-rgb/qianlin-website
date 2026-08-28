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

  // 默认租户使用根路径，避免产生重复 canonical。
  if (tenantSlug === DEFAULT_TENANT_SLUG) {
    return {
      title: "隐私政策",
      description: "网站隐私政策。",
      alternates: { canonical: "/privacy" },
    };
  }

  const legal = await getTenantLegalDocument(tenantSlug, "privacy");

  return {
    title: "隐私政策",
    description: `${tenantSlug} 隐私政策。`,
    alternates: {
      canonical: `/t/${encodeURIComponent(tenantSlug)}/privacy`,
    },
    robots: legal?.isPublic
      ? undefined
      : { index: false, follow: false },
  };
}

export default async function TenantPrivacyPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;

  // qianlin-travel 的正式法律页只有 /privacy。
  if (tenantSlug === DEFAULT_TENANT_SLUG) {
    redirect("/privacy");
  }

  const legal = await getTenantLegalDocument(tenantSlug, "privacy");

  if (!legal) notFound();

  return <LegalPage {...legal} />;
}
