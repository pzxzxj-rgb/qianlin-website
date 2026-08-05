import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AdminDashboard, AdminLogoutButton, AdminReloadButton } from "../../components/AdminDashboard";
import { getAdminSessionFromCookie } from "../../lib/admin/auth";
import { getAdminDashboard } from "../../lib/admin/getAdminDashboard";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function AdminPage() {
  const requestHeaders = await headers();
  const session = await getAdminSessionFromCookie(requestHeaders.get("cookie"));
  if (!session) redirect("/admin/login");

  let data: Awaited<ReturnType<typeof getAdminDashboard>>;
  try {
    data = await getAdminDashboard(session.tenantId);
  } catch (error) {
    console.error("Failed to load admin dashboard", error instanceof Error ? error.name : "UnknownError");
    return <main className="admin-page"><div className="admin-error-card"><span className="eyebrow">ADMIN</span><h1>后台资料暂时无法加载</h1><p>请稍后重试。如果问题持续，请检查后台运行配置。</p><div className="admin-error-actions"><AdminReloadButton /><AdminLogoutButton /></div></div></main>;
  }
  return <AdminDashboard data={data} />;
}
