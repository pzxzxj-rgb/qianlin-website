import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminProfileEditor } from "../../../components/AdminProfileEditor";
import { getAdminSessionFromCookie, requireAdminTenant } from "../../../lib/admin/auth";
import { getAdminProfile } from "../../../lib/admin/profile";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export const metadata: Metadata = {
  title: "编辑公司资料 | 黔林旅行社",
  robots: { index: false, follow: false },
  alternates: null,
  openGraph: null,
  twitter: null,
};

export default async function AdminProfilePage() {
  const requestHeaders = await headers();
  const session = await getAdminSessionFromCookie(requestHeaders.get("cookie"));
  if (!session) redirect("/admin/login");

  let profile: Awaited<ReturnType<typeof getAdminProfile>>;
  try {
    profile = await getAdminProfile(requireAdminTenant(session));
  } catch (error) {
    console.error("Failed to load admin profile", error instanceof Error ? error.name : "UnknownError");
    return <main className="admin-page"><div className="admin-error-card"><span className="eyebrow">ADMIN PROFILE</span><h1>公司资料暂时无法加载</h1><p>请稍后重试。如果问题持续，请检查后台运行配置。</p><Link className="button button-dark" href="/admin">返回后台</Link></div></main>;
  }

  if (!profile) return <main className="admin-page"><div className="admin-error-card"><span className="eyebrow">ADMIN PROFILE</span><h1>公司资料不存在</h1><p>黔林旅行社的正式资料暂时不可用，请返回后台查看。</p><Link className="button button-dark" href="/admin">返回后台</Link></div></main>;

  return <AdminProfileEditor initialValues={profile} />;
}
