"use client";

import Link from "next/link";
import { useState } from "react";
import type { AdminDashboardData } from "../lib/admin/getAdminDashboard";

export function AdminLogoutButton({ isDirty = false, disabled = false }: { isDirty?: boolean; disabled?: boolean }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function handleLogout() {
    if (pending || disabled) return;
    if (isDirty && !window.confirm("有未保存的修改，确定退出登录吗？")) return;
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/admin/logout", { method: "POST", cache: "no-store" });
      if (!response.ok) throw new Error("退出登录失败，请稍后重试。");
      window.location.replace("/admin/login");
    } catch (requestError) {
      setPending(false);
      setError(requestError instanceof Error && requestError.message ? requestError.message : "退出登录失败，请稍后重试。");
    }
  }

  return <span className="admin-logout-control"><button type="button" className="admin-logout" onClick={handleLogout} disabled={pending || disabled}>{pending ? "退出中…" : "退出登录"}</button>{error ? <span className="admin-action-error" role="alert">{error}</span> : null}</span>;
}

export function AdminReloadButton() {
  return <button type="button" className="button button-dark" onClick={() => window.location.reload()}>重新加载</button>;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return <div className="admin-info-row"><dt>{label}</dt><dd>{value || "未填写"}</dd></div>;
}

export function AdminDashboard({ data }: { data: AdminDashboardData }) {
  const status = data.tenant.siteStatus === "published" ? "已发布" : "配置中";
  const language = data.tenant.defaultLanguage === "en" ? "English" : "中文";

  return <main className="admin-page">
    <header className="admin-topbar"><Link className="admin-brand" href="/"><span className="brand-mark">{data.profile.logoMark || "Q"}</span><span><strong>{data.profile.companyNameEn}</strong><small>管理后台</small></span></Link><div className="admin-topbar-actions"><span className="admin-tenant-chip">{data.tenant.slug}</span><AdminLogoutButton /></div></header>
    <div className="admin-shell">
      <div className="admin-heading"><div><span className="eyebrow">QIANLIN TRAVEL · ADMIN</span><h1>旅行社管理后台</h1><p>查看运营概况，并管理公司资料、网站图片、联系方式和旅游线路。</p></div><Link className="button button-light admin-site-link" href="/">查看官网 <span aria-hidden="true">→</span></Link></div>

      <section className="admin-metrics" aria-label="运营概况">
        <article><span>Hero 图片</span><strong>{data.counts.heroImages}</strong></article>
        <article><span>旅游线路</span><strong>{data.counts.tours}</strong></article>
        <article><span>目的地</span><strong>{data.counts.destinations}</strong></article>
        <article><span>咨询总数</span><strong>{data.counts.inquiries}</strong></article>
        <article><span>新咨询</span><strong>{data.counts.newInquiries}</strong></article>
      </section>

      <div className="admin-grid">
        <section className="admin-card"><div className="admin-card-heading"><span className="eyebrow">TENANT</span><h2>当前租户</h2></div><dl className="admin-info-list"><InfoRow label="租户名称" value={`${data.tenant.nameZh} / ${data.tenant.nameEn}`} /><InfoRow label="租户 slug" value={data.tenant.slug} /><InfoRow label="站点状态" value={status} /><InfoRow label="默认语言" value={language} /></dl></section>
        <section className="admin-card"><div className="admin-card-heading"><div><span className="eyebrow">CONTACT</span><h2>公司资料</h2></div><div className="admin-card-heading-links"><Link className="button button-light admin-edit-profile-link" href="/admin/images">管理网站图片</Link><Link className="button button-light admin-edit-profile-link" href="/admin/contacts">管理联系方式</Link><Link className="button button-light admin-edit-profile-link" href="/admin/tours">管理旅游线路</Link><Link className="button button-light admin-edit-profile-link" href="/admin/destinations">管理目的地</Link><Link className="button button-light admin-edit-profile-link" href="/admin/profile">编辑公司资料</Link></div></div><dl className="admin-info-list"><InfoRow label="中文名称" value={data.profile.companyNameZh} /><InfoRow label="English name" value={data.profile.companyNameEn} /><InfoRow label="中文地址" value={data.profile.addressZh} /><InfoRow label="English address" value={data.profile.addressEn} /><InfoRow label="Logo 标志" value={data.profile.logoMark} /></dl></section>
        <section className="admin-card admin-card-wide"><div className="admin-card-heading"><span className="eyebrow">DESCRIPTION</span><h2>公司介绍</h2></div><div className="admin-description-grid"><p>{data.profile.descriptionZh || "未填写中文介绍"}</p><p>{data.profile.descriptionEn || "No English description"}</p></div></section>
        <section className="admin-card"><div className="admin-card-heading"><span className="eyebrow">CHANNELS</span><h2>联系方式</h2></div><dl className="admin-info-list"><InfoRow label="电话" value={data.contacts.phone} /><InfoRow label="邮箱" value={data.contacts.email} /><InfoRow label="微信" value={data.contacts.wechat} /></dl></section>
      </div>
      <p className="admin-readonly-note">本页面不会展示完整咨询留言，也不会提供删除或咨询详情操作。公司资料可通过编辑页面更新。</p>
    </div>
  </main>;
}
