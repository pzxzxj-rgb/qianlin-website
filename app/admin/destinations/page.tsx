import type { Metadata } from "next";
import Link from "next/link";
import { AdminDestinationManager } from "../../../components/AdminDestinationManager";
import { AdminLogoutButton } from "../../../components/AdminDashboard";
import { getAdminDestinationBundle } from "../../../lib/admin/destinations";
import { getAdminPageAccess } from "../../../lib/admin/pageAccess";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export const metadata: Metadata = {
  title: "目的地管理 | 黔林旅行社",
  description: "黔林旅行社后台目的地管理。",
  robots: { index: false, follow: false },
  alternates: null,
  openGraph: null,
  twitter: null,
};

export default async function AdminDestinationsPage({ tenantSlug }: { tenantSlug?: string } = {}) {
  const access = await getAdminPageAccess(tenantSlug, "editor");
  let bundle;
  try {
    bundle = await getAdminDestinationBundle(access.tenantId);
  } catch {
    return <main className="admin-page"><div className="admin-error-card"><span className="eyebrow">ADMIN DESTINATIONS</span><h1>目的地暂时无法加载</h1><p>请稍后重试。如果问题持续存在，请检查后台运行配置。</p><div className="admin-error-actions"><Link className="button button-light" href="/admin">返回后台</Link><AdminLogoutButton /></div></div></main>;
  }
  return <AdminDestinationManager initialValues={bundle.destinations} cityOptions={bundle.cityOptions} tenantSlug={access.tenantSlug} />;
}
