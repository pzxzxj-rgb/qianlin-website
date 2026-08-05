"use client";

import Link from "next/link";
import type { MouseEvent } from "react";
import { useState } from "react";
import { AdminLogoutButton } from "./AdminDashboard";
import { AdminProfileForm, confirmAdminProfileNavigation } from "./AdminProfileForm";
import type { AdminProfileValues } from "../lib/admin/profile";

export function AdminProfileEditor({ initialValues }: { initialValues: AdminProfileValues }) {
  const [isDirty, setIsDirty] = useState(false);

  function handleReturn(event: MouseEvent<HTMLAnchorElement>) {
    if (!confirmAdminProfileNavigation(isDirty)) event.preventDefault();
  }

  return <main className="admin-page">
    <header className="admin-topbar"><Link className="admin-brand" href="/admin" onClick={handleReturn}><span className="brand-mark">Q</span><span><strong>QIANLIN TRAVEL</strong><small>公司资料编辑</small></span></Link><div className="admin-topbar-actions"><Link className="admin-profile-back-link" href="/admin" onClick={handleReturn}>返回后台</Link><AdminLogoutButton /></div></header>
    <div className="admin-shell admin-profile-shell">
      <div className="admin-heading"><div><span className="eyebrow">QIANLIN TRAVEL · PROFILE</span><h1>编辑公司资料</h1><p>只修改黔林旅行社公开展示的公司文字资料。</p></div></div>
      <section className="admin-card admin-profile-card"><AdminProfileForm initialValues={initialValues} onDirtyChange={setIsDirty} /></section>
    </div>
  </main>;
}
