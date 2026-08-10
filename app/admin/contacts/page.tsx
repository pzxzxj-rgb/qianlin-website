import type { Metadata } from "next";
import Link from "next/link";
import { AdminContactManager } from "../../../components/AdminContactManager";
import { AdminLogoutButton } from "../../../components/AdminDashboard";
import { getAdminContacts } from "../../../lib/admin/contacts";
import { getAdminPageAccess } from "../../../lib/admin/pageAccess";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export const metadata: Metadata = {
  title: "联系方式管理 | 黔林旅行社",
  robots: { index: false, follow: false },
  alternates: null,
  openGraph: null,
  twitter: null,
};

export default async function AdminContactsPage({ tenantSlug }: { tenantSlug?: string } = {}) {
  const access = await getAdminPageAccess(tenantSlug, "editor");

  let contacts: Awaited<ReturnType<typeof getAdminContacts>>;
  try {
    contacts = await getAdminContacts(access.tenantId);
  } catch (error) {
    console.error("Failed to load admin contacts page", error instanceof Error ? error.name : "UnknownError");
    return <main className="admin-page"><div className="admin-error-card"><span className="eyebrow">ADMIN CONTACTS</span><h1>联系方式暂时无法加载</h1><p>请稍后重试。如果问题持续，请检查后台运行配置。</p><div className="admin-error-actions"><Link className="button button-light" href="/admin">返回后台</Link><AdminLogoutButton /></div></div></main>;
  }

  if (contacts.length === 0) return <main className="admin-page"><div className="admin-error-card"><span className="eyebrow">ADMIN CONTACTS</span><h1>联系方式记录不存在</h1><p>黔林旅行社当前没有可编辑的联系方式记录。</p><Link className="button button-dark" href="/admin">返回后台</Link></div></main>;

  return <AdminContactManager initialValues={contacts} tenantSlug={access.tenantSlug} />;
}
