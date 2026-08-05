"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ChangeEvent, FormEvent } from "react";
import { useEffect, useState } from "react";
import type { AdminHeroImageValues } from "../lib/admin/images";
import { ADMIN_IMAGE_CATALOG } from "../lib/admin/imageCatalog";
import { confirmAdminImageNavigation } from "../lib/admin/imageNavigation";
import { HERO_IMAGE_POSITIONS } from "../lib/admin/imagePositions";
import { AdminImagePreview } from "./AdminImagePreview";

type HeroImageResponse = {
  heroSlides?: AdminHeroImageValues[];
  errorZh?: string;
  fieldErrors?: Record<string, string>;
};

function isHeroImageValues(value: unknown): value is AdminHeroImageValues {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return ["imageUrl", "altZh", "altEn", "desktopPosition", "mobilePosition"].every((field) => typeof record[field] === "string");
}

function isHeroImageList(value: unknown): value is AdminHeroImageValues[] {
  return Array.isArray(value) && value.length === 2 && value.every(isHeroImageValues);
}

export function AdminHeroImagesForm({ initialValues, onDirtyChange }: { initialValues: AdminHeroImageValues[]; onDirtyChange: (isDirty: boolean) => void }) {
  const router = useRouter();
  const [values, setValues] = useState<AdminHeroImageValues[]>(initialValues);
  const [baseline, setBaseline] = useState<AdminHeroImageValues[]>(initialValues);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [pending, setPending] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const isDirty = JSON.stringify(values) !== JSON.stringify(baseline);

  useEffect(() => onDirtyChange(isDirty), [isDirty, onDirtyChange]);

  function updateField(index: number, field: keyof AdminHeroImageValues, value: string) {
    setValues((current) => current.map((slide, slideIndex) => slideIndex === index ? { ...slide, [field]: value } : slide));
    setFieldErrors((current) => ({ ...current, [`slides.${index}.${field}`]: "", [`slides.${index}`]: "" }));
    setError("");
    setSuccess("");
    setSessionExpired(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !isDirty) return;
    setPending(true);
    setError("");
    setSuccess("");
    setFieldErrors({});
    try {
      const response = await fetch("/api/admin/images/hero", { method: "PUT", headers: { "Content-Type": "application/json" }, cache: "no-store", body: JSON.stringify({ slides: values }) });
      const result = await response.json().catch(() => ({})) as HeroImageResponse;
      if (response.status === 401) {
        setSessionExpired(true);
        setError(result.errorZh || "登录状态已失效，请重新登录。");
      } else if (!response.ok) {
        setError(result.errorZh || "Hero 图片保存失败，请检查填写内容后重试。");
        setFieldErrors(result.fieldErrors || {});
      } else if (!isHeroImageList(result.heroSlides)) {
        setError("服务器返回的 Hero 图片格式不正确。");
      } else {
        setValues(result.heroSlides);
        setBaseline(result.heroSlides);
        setSuccess("Hero 图片已保存");
        router.refresh();
      }
    } catch {
      setError("Hero 图片保存失败，请检查网络后重试。");
    } finally {
      setPending(false);
    }
  }

  return <form className="admin-images-form" onSubmit={handleSubmit}>
    {error ? <div className="admin-form-error" role="alert">{error}{sessionExpired ? <Link href="/admin/login">重新登录</Link> : null}</div> : null}
    {success ? <p className="admin-save-success" role="status">{success}</p> : null}
    <div className="admin-image-card-grid">{values.map((slide, index) => {
      const option = ADMIN_IMAGE_CATALOG.find((image) => image.path === slide.imageUrl);
      const imageError = fieldErrors[`slides.${index}.imageUrl`];
      const altZhError = fieldErrors[`slides.${index}.altZh`];
      const altEnError = fieldErrors[`slides.${index}.altEn`];
      const desktopError = fieldErrors[`slides.${index}.desktopPosition`];
      const mobileError = fieldErrors[`slides.${index}.mobilePosition`];
      return <article className="admin-image-card" key={`hero-${index}`}>
        <div className="admin-image-card-heading"><div><span className="eyebrow">HERO {index + 1}</span><h3>首页 Hero 第 {index + 1} 张</h3></div><span className="admin-image-card-label">{option?.labelZh || "项目图片"}</span></div>
        <AdminImagePreview key={slide.imageUrl} src={slide.imageUrl} alt={slide.altZh} />
        <div className="admin-image-fields">
          <label>本地图片<select value={slide.imageUrl} onChange={(event: ChangeEvent<HTMLSelectElement>) => updateField(index, "imageUrl", event.target.value)} disabled={pending} aria-invalid={Boolean(imageError)} aria-describedby={imageError ? `hero-${index}-image-error` : undefined}><option value="" disabled>请选择项目图片</option>{ADMIN_IMAGE_CATALOG.map((image) => <option value={image.path} key={image.path}>{image.labelZh} · {image.path}</option>)}</select></label>
          <p className="admin-image-path">当前路径：{slide.imageUrl}</p>
          {imageError ? <p id={`hero-${index}-image-error`} className="admin-field-error" role="alert">{imageError}</p> : null}
          <label>中文替代文字<input value={slide.altZh} onChange={(event) => updateField(index, "altZh", event.target.value)} maxLength={160} disabled={pending} aria-invalid={Boolean(altZhError)} aria-describedby={altZhError ? `hero-${index}-alt-zh-error` : undefined} /></label>
          {altZhError ? <p id={`hero-${index}-alt-zh-error`} className="admin-field-error" role="alert">{altZhError}</p> : null}
          <label>英文替代文字<input value={slide.altEn} onChange={(event) => updateField(index, "altEn", event.target.value)} maxLength={220} disabled={pending} aria-invalid={Boolean(altEnError)} aria-describedby={altEnError ? `hero-${index}-alt-en-error` : undefined} /></label>
          {altEnError ? <p id={`hero-${index}-alt-en-error`} className="admin-field-error" role="alert">{altEnError}</p> : null}
          <label>桌面端图片位置<select value={slide.desktopPosition} onChange={(event) => updateField(index, "desktopPosition", event.target.value)} disabled={pending} aria-invalid={Boolean(desktopError)} aria-describedby={desktopError ? `hero-${index}-desktop-error` : undefined}>{HERO_IMAGE_POSITIONS.map((position) => <option value={position} key={position}>{position}</option>)}</select></label>
          {desktopError ? <p id={`hero-${index}-desktop-error`} className="admin-field-error" role="alert">{desktopError}</p> : null}
          <label>手机端图片位置<select value={slide.mobilePosition} onChange={(event) => updateField(index, "mobilePosition", event.target.value)} disabled={pending} aria-invalid={Boolean(mobileError)} aria-describedby={mobileError ? `hero-${index}-mobile-error` : undefined}>{HERO_IMAGE_POSITIONS.map((position) => <option value={position} key={position}>{position}</option>)}</select></label>
          {mobileError ? <p id={`hero-${index}-mobile-error`} className="admin-field-error" role="alert">{mobileError}</p> : null}
        </div>
      </article>;
    })}</div>
    <div className="admin-profile-actions"><button className="button button-dark" type="submit" disabled={pending || !isDirty}>{pending ? "保存中……" : "保存 Hero 图片"}</button><button className="button button-light" type="button" disabled={pending} onClick={() => { if (confirmAdminImageNavigation(isDirty)) router.push("/admin"); }}>取消</button></div>
  </form>;
}
