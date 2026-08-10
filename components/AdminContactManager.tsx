"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { adminApiPath, adminPagePath } from "./adminPaths";
import type { ChangeEvent, FormEvent, MouseEvent } from "react";
import { useState } from "react";
import { AdminLogoutButton } from "./AdminDashboard";
import { confirmAdminNavigation, useAdminUnsavedChanges } from "./useAdminUnsavedChanges";
import type { AdminContactChannelValues, AdminContactFieldErrors, AdminContactStatus, AdminContactType } from "../lib/admin/contacts";

type AdminContactResponse = {
  contacts?: AdminContactChannelValues[];
  errorZh?: string;
  fieldErrors?: AdminContactFieldErrors;
};

const TYPE_LABELS: Record<AdminContactType, string> = {
  phone: "电话",
  wechat: "微信",
  email: "邮箱",
};

const STATUS_LABELS: Record<AdminContactStatus, string> = {
  draft: "草稿",
  published: "已发布",
  archived: "已归档",
};

const ADMIN_CONTACT_STATUSES: AdminContactStatus[] = ["draft", "published", "archived"];

function cloneValues(values: AdminContactChannelValues[]) {
  return values.map((value) => ({ ...value }));
}

function isAdminContactValues(value: unknown): value is AdminContactChannelValues[] {
  if (!Array.isArray(value) || value.length === 0) return false;
  return value.every((contact) => {
    if (!contact || typeof contact !== "object" || Array.isArray(contact)) return false;
    const record = contact as Record<string, unknown>;
    return typeof record.id === "string" && typeof record.type === "string" && typeof record.labelZh === "string" && typeof record.labelEn === "string" && typeof record.value === "string" && typeof record.href === "string" && typeof record.displayOrder === "number" && typeof record.status === "string";
  });
}

export function confirmAdminContactNavigation(isDirty: boolean) {
  return confirmAdminNavigation(isDirty, "有未保存的修改，确定返回后台吗？");
}

type EditableContactField = Exclude<keyof AdminContactChannelValues, "id" | "type">;

export function AdminContactManager({ initialValues, tenantSlug }: { initialValues: AdminContactChannelValues[]; tenantSlug?: string }) {
  const router = useRouter();
  const [values, setValues] = useState<AdminContactChannelValues[]>(() => cloneValues(initialValues));
  const [baseline, setBaseline] = useState<AdminContactChannelValues[]>(() => cloneValues(initialValues));
  const [fieldErrors, setFieldErrors] = useState<AdminContactFieldErrors>({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [pending, setPending] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const isDirty = JSON.stringify(values) !== JSON.stringify(baseline);

  useAdminUnsavedChanges(isDirty, "有未保存的修改，确定离开联系方式管理吗？");

  function handleReturn(event: MouseEvent<HTMLAnchorElement>) {
    if (!confirmAdminContactNavigation(isDirty)) event.preventDefault();
  }

  function updateField(index: number, field: EditableContactField, event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const rawValue = event.target.value;
    setValues((current) => current.map((contact, contactIndex) => contactIndex === index ? { ...contact, [field]: field === "displayOrder" ? Number(rawValue) : rawValue } : contact));
    setFieldErrors((current) => {
      const next = { ...current };
      delete next[`channels.${index}.${field}`];
      return next;
    });
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

    const payload = { channels: values.map(({ id, type, labelZh, labelEn, value, href, displayOrder, status }) => ({ id, type, labelZh, labelEn, value, href, displayOrder, status })) };
    try {
      const response = await fetch(adminApiPath(tenantSlug, "/contacts"), { method: "PUT", headers: { "Content-Type": "application/json" }, cache: "no-store", body: JSON.stringify(payload) });
      const result = await response.json().catch(() => ({})) as AdminContactResponse;
      if (response.status === 401) {
        setSessionExpired(true);
        setError(result.errorZh || "登录状态已失效，请重新登录。");
      } else if (!response.ok) {
        setError(result.errorZh || "联系方式保存失败，请检查填写内容后重试。");
        setFieldErrors(result.fieldErrors || {});
      } else if (!isAdminContactValues(result.contacts)) {
        setError("服务器返回的联系方式格式不正确。");
      } else {
        setValues(cloneValues(result.contacts));
        setBaseline(cloneValues(result.contacts));
        setSuccess("联系方式已保存");
        router.refresh();
      }
    } catch {
      setError("联系方式保存失败，请检查网络后重试。");
    } finally {
      setPending(false);
    }
  }

  function renderField(index: number, field: "labelZh" | "labelEn" | "value" | "href" | "displayOrder") {
    const contact = values[index];
    const errorKey = `channels.${index}.${field}`;
    const fieldError = fieldErrors[errorKey];
    const id = `${field}-${index}`;
    const label = field === "labelZh" ? "中文显示名称" : field === "labelEn" ? "英文显示名称" : field === "value" ? "联系方式内容" : field === "href" ? "跳转链接" : "显示顺序";
    const placeholder = field === "href" ? "可留空，或填写安全的 tel:、mailto:、https: 链接" : field === "value" ? "请输入联系方式内容" : undefined;
    return <div className="admin-contact-field" key={field}><label htmlFor={id}>{label}</label><input id={id} name={id} type={field === "displayOrder" ? "number" : "text"} inputMode={field === "displayOrder" ? "numeric" : field === "value" && contact.type === "phone" ? "tel" : undefined} min={field === "displayOrder" ? 0 : undefined} max={field === "displayOrder" ? 1000 : undefined} step={field === "displayOrder" ? 1 : undefined} value={contact[field]} placeholder={placeholder} disabled={pending} aria-invalid={Boolean(fieldError)} aria-describedby={fieldError ? `${id}-error` : undefined} onChange={(event) => updateField(index, field, event)} />{fieldError ? <p id={`${id}-error`} className="admin-field-error" role="alert">{fieldError}</p> : null}</div>;
  }

  return <main className="admin-page">
    <header className="admin-topbar"><Link className="admin-brand" href={adminPagePath(tenantSlug, "")} onClick={handleReturn}><span className="brand-mark">Q</span><span><strong>QIANLIN TRAVEL</strong><small>联系方式管理</small></span></Link><div className="admin-topbar-actions"><Link className="admin-profile-back-link" href={adminPagePath(tenantSlug, "")} onClick={handleReturn}>返回后台</Link><AdminLogoutButton isDirty={isDirty} disabled={pending} /></div></header>
    <div className="admin-shell admin-contacts-shell">
      <div className="admin-heading"><div><span className="eyebrow">QIANLIN TRAVEL · CONTACTS</span><h1>联系方式管理</h1><p>编辑官网公开展示的电话、微信和邮箱。当前页面只管理黔林旅行社已有记录。</p></div></div>
      <section className="admin-card admin-contacts-card">
        <div className="admin-card-heading"><div><span className="eyebrow">CONTACT CHANNELS</span><h2>联系方式记录</h2></div><span className="admin-image-count">{values.length} 条记录</span></div>
        <form className="admin-contacts-form" onSubmit={handleSubmit} aria-busy={pending}>
          <p className="admin-contact-loading" role="status" aria-live="polite">{pending ? "正在保存联系方式……" : "联系方式已加载"}</p>
          {error ? <div className="admin-form-error" role="alert">{error}{sessionExpired ? <Link href="/admin/login">重新登录</Link> : null}</div> : null}
          {success ? <p className="admin-save-success" role="status">{success}</p> : null}
          <div className="admin-contact-list">{values.map((contact, index) => <article className="admin-contact-card" key={contact.id}><div className="admin-contact-card-heading"><div><span className="eyebrow">CHANNEL {index + 1}</span><h3>{TYPE_LABELS[contact.type]}</h3></div><span className="admin-contact-id">已有记录</span></div><div className="admin-contact-fields"><div className="admin-contact-field"><label htmlFor={`type-${index}`}>类型</label><output id={`type-${index}`} className="admin-contact-readonly">{TYPE_LABELS[contact.type]}</output></div>{renderField(index, "labelZh")}{renderField(index, "labelEn")}{renderField(index, "value")}{renderField(index, "href")}{renderField(index, "displayOrder")}<div className="admin-contact-field"><label htmlFor={`status-${index}`}>状态</label><select id={`status-${index}`} name={`status-${index}`} value={contact.status} disabled={pending} aria-invalid={Boolean(fieldErrors[`channels.${index}.status`])} aria-describedby={fieldErrors[`channels.${index}.status`] ? `status-${index}-error` : undefined} onChange={(event) => updateField(index, "status", event)}>{ADMIN_CONTACT_STATUSES.map((status) => <option value={status} key={status}>{STATUS_LABELS[status]}</option>)}</select>{fieldErrors[`channels.${index}.status`] ? <p id={`status-${index}-error`} className="admin-field-error" role="alert">{fieldErrors[`channels.${index}.status`]}</p> : null}</div></div></article>)}</div>
          <div className="admin-profile-actions"><button className="button button-dark" type="submit" disabled={pending || !isDirty}>{pending ? "保存中……" : "保存联系方式"}</button><button className="button button-light" type="button" disabled={pending} onClick={() => { if (confirmAdminContactNavigation(isDirty)) router.push(adminPagePath(tenantSlug, "")); }}>取消</button></div>
        </form>
      </section>
    </div>
  </main>;
}
