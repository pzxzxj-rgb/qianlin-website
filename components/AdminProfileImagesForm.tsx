"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ChangeEvent, FormEvent } from "react";
import { useEffect, useState } from "react";
import type { AdminProfileImageField, AdminProfileImageValues } from "../lib/admin/images";
import { ADMIN_IMAGE_CATALOG, getAdminImageOption } from "../lib/admin/imageCatalog";
import { confirmAdminImageNavigation } from "../lib/admin/imageNavigation";
import { AdminImagePreview } from "./AdminImagePreview";

type ProfileImageResponse = {
  profile?: AdminProfileImageValues;
  errorZh?: string;
  fieldErrors?: Record<string, string>;
};

const FIELDS: Array<{ field: AdminProfileImageField; label: string; altLabel: string; maxLength: number }> = [
  { field: "aboutImageUrl", label: "关于我们图片", altLabel: "关于我们", maxLength: 160 },
  { field: "customizeImageUrl", label: "定制咨询图片", altLabel: "定制咨询", maxLength: 160 },
];

function isProfileImageValues(value: unknown): value is AdminProfileImageValues {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return ["aboutImageUrl", "aboutImageAltZh", "aboutImageAltEn", "customizeImageUrl", "customizeImageAltZh", "customizeImageAltEn"].every((field) => typeof record[field] === "string");
}

export function AdminProfileImagesForm({ initialValues, onDirtyChange }: { initialValues: AdminProfileImageValues; onDirtyChange: (isDirty: boolean) => void }) {
  const router = useRouter();
  const [values, setValues] = useState<AdminProfileImageValues>(initialValues);
  const [baseline, setBaseline] = useState<AdminProfileImageValues>(initialValues);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [pending, setPending] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const isDirty = JSON.stringify(values) !== JSON.stringify(baseline);

  useEffect(() => onDirtyChange(isDirty), [isDirty, onDirtyChange]);

  function updateField(field: AdminProfileImageField, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: "" }));
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
      const response = await fetch("/api/admin/images/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, cache: "no-store", body: JSON.stringify(values) });
      const result = await response.json().catch(() => ({})) as ProfileImageResponse;
      if (response.status === 401) {
        setSessionExpired(true);
        setError(result.errorZh || "登录状态已失效，请重新登录。");
      } else if (!response.ok) {
        setError(result.errorZh || "页面图片保存失败，请检查填写内容后重试。");
        setFieldErrors(result.fieldErrors || {});
      } else if (!isProfileImageValues(result.profile)) {
        setError("服务器返回的图片资料格式不正确。");
      } else {
        setValues(result.profile);
        setBaseline(result.profile);
        setSuccess("页面内容图片已保存");
        router.refresh();
      }
    } catch {
      setError("页面图片保存失败，请检查网络后重试。");
    } finally {
      setPending(false);
    }
  }

  function renderImageField(field: "aboutImageUrl" | "customizeImageUrl", index: number) {
    const altZhField = field === "aboutImageUrl" ? "aboutImageAltZh" : "customizeImageAltZh";
    const altEnField = field === "aboutImageUrl" ? "aboutImageAltEn" : "customizeImageAltEn";
    const option = getAdminImageOption(values[field]);
    const definition = FIELDS[index];
    const imageError = fieldErrors[field];
    const altZhError = fieldErrors[altZhField];
    const altEnError = fieldErrors[altEnField];
    return <article className="admin-image-card" key={field}>
      <div className="admin-image-card-heading"><div><span className="eyebrow">{index === 0 ? "ABOUT" : "CUSTOMIZE"}</span><h3>{definition.label}</h3></div><span className="admin-image-card-label">{option?.labelZh || "项目图片"}</span></div>
      <AdminImagePreview key={values[field]} src={values[field]} alt={values[altZhField]} />
      <div className="admin-image-fields">
        <label>本地图片<select value={values[field]} onChange={(event: ChangeEvent<HTMLSelectElement>) => updateField(field, event.target.value)} disabled={pending} aria-invalid={Boolean(imageError)} aria-describedby={imageError ? `${field}-error` : undefined}><option value="" disabled>请选择项目图片</option>{ADMIN_IMAGE_CATALOG.map((image) => <option value={image.path} key={image.path}>{image.labelZh} · {image.path}</option>)}</select></label>
        <p className="admin-image-path">当前路径：{values[field]}</p>
        {imageError ? <p id={`${field}-error`} className="admin-field-error" role="alert">{imageError}</p> : null}
        <label>中文替代文字<input value={values[altZhField]} onChange={(event) => updateField(altZhField, event.target.value)} maxLength={definition.maxLength} disabled={pending} aria-invalid={Boolean(altZhError)} aria-describedby={altZhError ? `${altZhField}-error` : undefined} /></label>
        {altZhError ? <p id={`${altZhField}-error`} className="admin-field-error" role="alert">{altZhError}</p> : null}
        <label>英文替代文字<input value={values[altEnField]} onChange={(event) => updateField(altEnField, event.target.value)} maxLength={220} disabled={pending} aria-invalid={Boolean(altEnError)} aria-describedby={altEnError ? `${altEnField}-error` : undefined} /></label>
        {altEnError ? <p id={`${altEnField}-error`} className="admin-field-error" role="alert">{altEnError}</p> : null}
      </div>
    </article>;
  }

  return <form className="admin-images-form" onSubmit={handleSubmit}>
    {error ? <div className="admin-form-error" role="alert">{error}{sessionExpired ? <Link href="/admin/login">重新登录</Link> : null}</div> : null}
    {success ? <p className="admin-save-success" role="status">{success}</p> : null}
    <div className="admin-image-card-grid">{renderImageField("aboutImageUrl", 0)}{renderImageField("customizeImageUrl", 1)}</div>
    <div className="admin-profile-actions"><button className="button button-dark" type="submit" disabled={pending || !isDirty}>{pending ? "保存中……" : "保存页面图片"}</button><button className="button button-light" type="button" disabled={pending} onClick={() => { if (confirmAdminImageNavigation(isDirty)) router.push("/admin"); }}>取消</button></div>
  </form>;
}
