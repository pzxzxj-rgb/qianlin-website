import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminContactManager } from "../../../components/AdminContactManager";
import { AdminLogoutButton } from "../../../components/AdminDashboard";
import { getAdminSessionFromCookie, requireAdminTenant } from "../../../lib/admin/auth";
import { getAdminContacts } from "../../../lib/admin/contacts";

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

export default async function AdminContactsPage() {
  const requestHeaders = await headers();
  const session = await getAdminSessionFromCookie(requestHeaders.get("cookie"));
  if (!session) redirect("/admin/login");

  let contacts: Awaited<ReturnType<typeof getAdminContacts>>;
  try {
    contacts = await getAdminContacts(requireAdminTenant(session));
  } catch (error) {
    console.error("Failed to load admin contacts page", error instanceof Error ? error.name : "UnknownError");
    return <main className="admin-page"><div className="admin-error-card"><span className="eyebrow">ADMIN CONTACTS</span><h1>联系方式暂时无法加载</h1><p>请稍后重试。如果问题持续，请检查后台运行配置。</p><div className="admin-error-actions"><Link className="button button-light" href="/admin">返回后台</Link><AdminLogoutButton /></div></div></main>;
  }

  if (contacts.length === 0) return <main className="admin-page"><div className="admin-error-card"><span className="eyebrow">ADMIN CONTACTS</span><h1>联系方式记录不存在</h1><p>黔林旅行社当前没有可编辑的联系方式记录。</p><Link className="button button-dark" href="/admin">返回后台</Link></div></main>;

  return <AdminContactManager initialValues={contacts} />;
}
