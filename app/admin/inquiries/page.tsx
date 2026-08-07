import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AdminInquiryManager } from "../../../components/AdminInquiryManager";
import { getAdminSessionFromCookie, requireAdminTenant } from "../../../lib/admin/auth";
import { getAdminInquiries } from "../../../lib/admin/inquiries";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export const metadata: Metadata = {
  title: "咨询管理 | 黔林旅行社",
  robots: { index: false, follow: false },
  alternates: null,
  openGraph: null,
  twitter: null,
};

export default async function AdminInquiriesPage() {
  const requestHeaders = await headers();
  const session = await getAdminSessionFromCookie(requestHeaders.get("cookie"));
  if (!session) redirect("/admin/login");

  let data: Awaited<ReturnType<typeof getAdminInquiries>>;
  try {
    data = await getAdminInquiries(requireAdminTenant(session), { page: 1, pageSize: 20 });
  } catch (error) {
    console.error("Failed to load admin inquiry list", error instanceof Error ? error.name : "UnknownError");
    return <main className="admin-page"><div className="admin-error-card"><span className="eyebrow">ADMIN INQUIRIES</span><h1>咨询列表暂时无法加载</h1><p>请稍后重试。如果问题持续，请检查后台运行配置。</p></div></main>;
  }

  return <AdminInquiryManager initialData={data} />;
}
