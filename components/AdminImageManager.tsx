"use client";

import Link from "next/link";
import type { MouseEvent } from "react";
import { useEffect, useState } from "react";
import type { AdminImageSettings } from "../lib/admin/images";
import { confirmAdminImageNavigation } from "../lib/admin/imageNavigation";
import { AdminHeroImagesForm } from "./AdminHeroImagesForm";
import { AdminLogoutButton } from "./AdminDashboard";
import { adminPagePath } from "./adminPaths";
import { AdminProfileImagesForm } from "./AdminProfileImagesForm";

export function AdminImageManager({ initialSettings, tenantSlug }: { initialSettings: AdminImageSettings; tenantSlug?: string }) {
  const [heroDirty, setHeroDirty] = useState(false);
  const [profileDirty, setProfileDirty] = useState(false);
  const isDirty = heroDirty || profileDirty;

  useEffect(() => {
    if (!isDirty) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  function handleReturn(event: MouseEvent<HTMLAnchorElement>) {
    if (!confirmAdminImageNavigation(isDirty)) event.preventDefault();
  }

  return <main className="admin-page">
    <header className="admin-topbar"><Link className="admin-brand" href={adminPagePath(tenantSlug, "")} onClick={handleReturn}><span className="brand-mark">Q</span><span><strong>QIANLIN TRAVEL</strong><small>网站图片管理</small></span></Link><div className="admin-topbar-actions"><Link className="admin-profile-back-link" href={adminPagePath(tenantSlug, "")} onClick={handleReturn}>返回后台</Link><AdminLogoutButton /></div></header>
    <div className="admin-shell admin-images-shell">
      <div className="admin-heading"><div><span className="eyebrow">QIANLIN TRAVEL · IMAGES</span><h1>网站图片管理</h1><p>从项目内置图片中选择 Hero、关于我们和定制咨询区域使用的图片。</p></div></div>
      <section className="admin-card admin-images-section"><div className="admin-card-heading"><div><span className="eyebrow">HERO SLIDES</span><h2>Hero 轮播图片</h2></div><span className="admin-image-count">固定两张</span></div><AdminHeroImagesForm initialValues={initialSettings.heroSlides} onDirtyChange={setHeroDirty} /></section>
      <section className="admin-card admin-images-section"><div className="admin-card-heading"><div><span className="eyebrow">PAGE IMAGES</span><h2>页面内容图片</h2></div><span className="admin-image-count">About · Customize</span></div><AdminProfileImagesForm initialValues={initialSettings.profile} onDirtyChange={setProfileDirty} /></section>
    </div>
  </main>;
}
