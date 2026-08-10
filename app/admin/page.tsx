import type { Metadata } from "next";
import { AdminDashboard, AdminLogoutButton, AdminReloadButton } from "../../components/AdminDashboard";
import { getAdminDashboard } from "../../lib/admin/getAdminDashboard";
import { getAdminPageAccess } from "../../lib/admin/pageAccess";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export const metadata: Metadata = {
  title: "黔林旅行社管理后台",
  robots: { index: false, follow: false },
  alternates: null,
  openGraph: null,
  twitter: null,
};

export default async function AdminPage({ tenantSlug }: { tenantSlug?: string } = {}) {
  const access = await getAdminPageAccess(tenantSlug, "viewer");

  let data: Awaited<ReturnType<typeof getAdminDashboard>>;
  try {
    data = await getAdminDashboard(access.tenantId);
  } catch (error) {
    console.error("Failed to load admin dashboard", error instanceof Error ? error.name : "UnknownError");
    return <main className="admin-page"><div className="admin-error-card"><span className="eyebrow">ADMIN</span><h1>后台资料暂时无法加载</h1><p>请稍后重试。如果问题持续，请检查后台运行配置。</p><div className="admin-error-actions"><AdminReloadButton /><AdminLogoutButton /></div></div></main>;
  }
  return <AdminDashboard data={data} />;
}
