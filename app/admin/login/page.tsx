import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminLoginForm } from "../../../components/AdminLoginForm";
import { getAdminSessionFromCookie } from "../../../lib/admin/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export const metadata: Metadata = {
  title: "黔林旅行社后台登录",
  robots: { index: false, follow: false },
  alternates: null,
  openGraph: null,
  twitter: null,
};

export default async function AdminLoginPage() {
  const requestHeaders = await headers();
  if (await getAdminSessionFromCookie(requestHeaders.get("cookie"))) redirect("/admin");

  return <main className="admin-login-page"><section className="admin-login-card"><Link className="admin-login-brand" href="/"><span className="brand-mark">Q</span><span><strong>QIANLIN TRAVEL</strong><small>黔林旅行社</small></span></Link><span className="eyebrow">ADMIN ACCESS</span><h1>后台登录</h1><p>仅限黔林旅行社管理员查看站点资料和运营概况。</p><AdminLoginForm /><Link className="admin-back-link" href="/">返回官网</Link></section></main>;
}
