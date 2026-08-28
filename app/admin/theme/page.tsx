import type { Metadata } from "next";
import Link from "next/link";
import { AdminThemeStudio } from "../../../components/AdminThemeStudio";
import { getAdminThemeState } from "../../../lib/admin/theme";
import { hasAdminPermission } from "../../../lib/admin/permissions";
import { getAdminPageAccess } from "../../../lib/admin/pageAccess";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export const metadata: Metadata = { title: "网站可视化编辑器", robots: { index: false, follow: false }, alternates: null, openGraph: null, twitter: null };

export default async function AdminThemePage({ tenantSlug }: { tenantSlug?: string } = {}) {
  const access = await getAdminPageAccess(tenantSlug, "viewer", "theme:read");
  let state: Awaited<ReturnType<typeof getAdminThemeState>>;
  try {
    state = await getAdminThemeState(access.tenantId);
  } catch (error) {
    console.error("Failed to load admin theme page", error instanceof Error ? error.name : "UnknownError");
    return (
      <main className="admin-page">
        <div className="admin-error-card">
          <span className="eyebrow">主题编辑器</span>

          <h1>主题配置暂时无法加载</h1>

          <p>
            请返回管理后台后重试。如果问题持续存在，请检查本地数据库迁移和运行配置。
          </p>

          <Link
            className="button button-dark"
            href={
              tenantSlug
                ? `/admin/t/${encodeURIComponent(tenantSlug)}`
                : "/admin"
            }
          >
            返回管理后台
          </Link>
        </div>
      </main>
    );
  }
  return <AdminThemeStudio initialState={state} tenantSlug={access.tenantSlug} canEdit={hasAdminPermission(access.role, "theme:update_draft")} canPublish={hasAdminPermission(access.role, "theme:publish")} />;
}
