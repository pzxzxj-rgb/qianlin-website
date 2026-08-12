import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminInquiryDetail } from "../../../../components/AdminInquiryDetail";
import { getAdminInquiryDetail } from "../../../../lib/admin/inquiries";
import { getAdminPageAccess } from "../../../../lib/admin/pageAccess";

type AdminInquiryDetailPageProps = { params: Promise<{ inquiryId: string }>; tenantSlug?: string };

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export const metadata: Metadata = {
  title: "咨询详情 | 黔林旅行社",
  robots: { index: false, follow: false },
  alternates: null,
  openGraph: null,
  twitter: null,
};

export default async function AdminInquiryDetailPage({ params, tenantSlug }: AdminInquiryDetailPageProps) {
  const access = await getAdminPageAccess(tenantSlug, "editor", "inquiry:read_sensitive");
  const { inquiryId: rawInquiryId } = await params;
  const inquiryId = Number(rawInquiryId);
  if (!Number.isSafeInteger(inquiryId) || inquiryId <= 0) notFound();

  let inquiry: Awaited<ReturnType<typeof getAdminInquiryDetail>>;
  try {
    inquiry = await getAdminInquiryDetail(access.tenantId, inquiryId, access.role);
  } catch (error) {
    console.error("Failed to load admin inquiry detail page", error instanceof Error ? error.name : "UnknownError");
    return <main className="admin-page"><div className="admin-error-card"><span className="eyebrow">ADMIN INQUIRY</span><h1>咨询详情暂时无法加载</h1><p>请稍后重试。如果问题持续，请检查后台运行配置。</p></div></main>;
  }
  if (!inquiry) notFound();

  return <AdminInquiryDetail initialInquiry={inquiry} tenantSlug={access.tenantSlug} />;
}
