import type { Metadata } from "next";
import Link from "next/link";
import { AdminLogoutButton } from "../../../components/AdminDashboard";
import { AdminTourManager } from "../../../components/AdminTourManager";
import { getAdminTours } from "../../../lib/admin/tours";
import { getAdminPageAccess } from "../../../lib/admin/pageAccess";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export const metadata: Metadata = {
  title: "旅游线路管理 | 黔林旅行社",
  robots: { index: false, follow: false },
  alternates: null,
  openGraph: null,
  twitter: null,
};

export default async function AdminToursPage({ tenantSlug }: { tenantSlug?: string } = {}) {
  const access = await getAdminPageAccess(tenantSlug, "editor");

  let tours: Awaited<ReturnType<typeof getAdminTours>>;
  try {
    tours = await getAdminTours(access.tenantId);
  } catch (error) {
    console.error("Failed to load admin tours page", error instanceof Error ? error.name : "UnknownError");
    return <main className="admin-page"><div className="admin-error-card"><span className="eyebrow">ADMIN TOURS</span><h1>旅游线路暂时无法加载</h1><p>请稍后重试。如果问题持续，请检查后台运行配置。</p><div className="admin-error-actions"><Link className="button button-light" href="/admin">返回后台</Link><AdminLogoutButton /></div></div></main>;
  }

  return <AdminTourManager initialValues={tours} tenantSlug={access.tenantSlug} />;
}
