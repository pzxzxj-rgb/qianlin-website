"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ChangeEvent, FormEvent } from "react";
import { useEffect, useState } from "react";
import type { AdminProfileField, AdminProfileFieldErrors, AdminProfileValues } from "../lib/admin/profile";

type AdminProfileResponse = {
  profile?: AdminProfileValues;
  errorZh?: string;
  fieldErrors?: AdminProfileFieldErrors;
};

export function confirmAdminProfileNavigation(isDirty: boolean) {
  return !isDirty || window.confirm("有未保存的修改，确定返回后台吗？");
}

type FieldDefinition = {
  label: string;
  maxLength: number;
  multiline?: boolean;
  placeholder?: string;
};

const FIELD_DEFINITIONS: Record<AdminProfileField, FieldDefinition> = {
  companyNameZh: { label: "中文公司名称", maxLength: 100 },
  companyNameEn: { label: "英文公司名称", maxLength: 160 },
  descriptionZh: { label: "中文公司介绍", maxLength: 1000, multiline: true },
  descriptionEn: { label: "英文公司介绍", maxLength: 1500, multiline: true },
  addressZh: { label: "中文地址", maxLength: 300 },
  addressEn: { label: "英文地址", maxLength: 500 },
  logoMark: { label: "Logo 文字标志", maxLength: 4, placeholder: "例如 Q" },
};

const FIELD_ORDER: AdminProfileField[] = [
  "companyNameZh",
  "companyNameEn",
  "descriptionZh",
  "descriptionEn",
  "addressZh",
  "addressEn",
  "logoMark",
];

function isAdminProfileValues(value: unknown): value is AdminProfileValues {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as { [key: string]: unknown };
  return FIELD_ORDER.every((field) => typeof record[field] === "string");
}

export function AdminProfileForm({ initialValues, onDirtyChange }: { initialValues: AdminProfileValues; onDirtyChange?: (isDirty: boolean) => void }) {
  const router = useRouter();
  const [values, setValues] = useState<AdminProfileValues>(initialValues);
  const [baseline, setBaseline] = useState<AdminProfileValues>(initialValues);
  const [fieldErrors, setFieldErrors] = useState<AdminProfileFieldErrors>({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [pending, setPending] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const isDirty = JSON.stringify(values) !== JSON.stringify(baseline);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  useEffect(() => {
    if (!isDirty) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  function updateField(field: AdminProfileField, event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setValues((current) => ({ ...current, [field]: event.target.value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
    setError("");
    setSuccess("");
    setSessionExpired(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError("");
    setSuccess("");
    setFieldErrors({});
    setSessionExpired(false);

    const payload: AdminProfileValues = {
      companyNameZh: values.companyNameZh,
      companyNameEn: values.companyNameEn,
      descriptionZh: values.descriptionZh,
      descriptionEn: values.descriptionEn,
      addressZh: values.addressZh,
      addressEn: values.addressEn,
      logoMark: values.logoMark,
    };

    try {
      const response = await fetch("/api/admin/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({})) as AdminProfileResponse;
      if (response.status === 401) {
        setSessionExpired(true);
        setError(result.errorZh || "登录状态已失效，请重新登录。");
      } else if (!response.ok) {
        setError(result.errorZh || "资料保存失败，请检查填写内容后重试。");
        setFieldErrors(result.fieldErrors || {});
      } else if (!isAdminProfileValues(result.profile)) {
        setError("服务器返回的资料格式不正确。");
      } else {
        setValues(result.profile);
        setBaseline(result.profile);
        setSuccess("公司资料已保存");
        router.refresh();
      }
    } catch {
      setError("资料保存失败，请检查网络后重试。");
    } finally {
      setPending(false);
    }
  }

  function renderField(field: AdminProfileField) {
    const definition = FIELD_DEFINITIONS[field];
    const fieldError = fieldErrors[field];
    const errorId = `${field}-error`;
    const commonProps = {
      id: field,
      name: field,
      value: values[field],
      maxLength: definition.maxLength,
      placeholder: definition.placeholder,
      disabled: pending,
      "aria-invalid": Boolean(fieldError),
      "aria-describedby": fieldError ? errorId : undefined,
      onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => updateField(field, event),
    };

    return <div className={`admin-profile-field ${definition.multiline ? "admin-profile-field-wide" : ""}`} key={field}>
      <label htmlFor={field}>{definition.label}<span>最多 {definition.maxLength} 个字符</span></label>
      {definition.multiline ? <textarea {...commonProps} rows={6} /> : <input {...commonProps} type="text" autoComplete="off" />}
      {fieldError ? <p id={errorId} className="admin-field-error" role="alert">{fieldError}</p> : null}
    </div>;
  }

  return <form className="admin-profile-form" onSubmit={handleSubmit}>
    {error ? <div className="admin-form-error" role="alert">{error}{sessionExpired ? <Link href="/admin/login">重新登录</Link> : null}</div> : null}
    {success ? <p className="admin-save-success" role="status">{success}</p> : null}
    <div className="admin-profile-field-grid">{FIELD_ORDER.map(renderField)}</div>
    <div className="admin-profile-actions">
      <button className="button button-dark" type="submit" disabled={pending || !isDirty}>{pending ? "保存中……" : "保存资料"}</button>
      <button className="button button-light" type="button" disabled={pending} onClick={() => {
        if (confirmAdminProfileNavigation(isDirty)) router.push("/admin");
      }}>取消</button>
    </div>
  </form>;
}
