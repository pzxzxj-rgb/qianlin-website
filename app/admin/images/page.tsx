import type { Metadata } from "next";
import Link from "next/link";
import { AdminImageManager } from "../../../components/AdminImageManager";
import { AdminLogoutButton } from "../../../components/AdminDashboard";
import { AdminImageConfigurationError, getAdminImageSettings } from "../../../lib/admin/images";
import { getAdminPageAccess } from "../../../lib/admin/pageAccess";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export const metadata: Metadata = {
  title: "网站图片管理 | 黔林旅行社",
  robots: { index: false, follow: false },
  alternates: null,
  openGraph: null,
  twitter: null,
};

export default async function AdminImagesPage({ tenantSlug }: { tenantSlug?: string } = {}) {
  const access = await getAdminPageAccess(tenantSlug, "editor");
  let settings: Awaited<ReturnType<typeof getAdminImageSettings>>;
  try {
    settings = await getAdminImageSettings(access.tenantId);
  } catch (error) {
    console.error("Failed to load admin image settings", error instanceof AdminImageConfigurationError ? error.name : error instanceof Error ? error.name : "UnknownError");
    return <main className="admin-page"><div className="admin-error-card"><span className="eyebrow">ADMIN IMAGES</span><h1>网站图片暂时无法加载</h1><p>当前 Hero 或正式资料配置不符合图片管理要求，请检查数据库中的已发布配置。</p><div className="admin-error-actions"><Link className="button button-light" href="/admin">返回后台</Link><AdminLogoutButton /></div></div></main>;
  }
  return <AdminImageManager initialSettings={settings} tenantSlug={access.tenantSlug} />;
}
