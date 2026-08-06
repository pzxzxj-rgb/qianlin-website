"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ChangeEvent, FormEvent, MouseEvent } from "react";
import { useEffect, useState } from "react";
import { getAdminImageOptions } from "../lib/admin/imageCatalog";
import type { AdminTourFieldErrors, AdminTourInput, AdminTourStatus, AdminTourValues } from "../lib/admin/tours";
import { AdminLogoutButton } from "./AdminDashboard";
import { AdminImagePreview } from "./AdminImagePreview";

type AdminTourResponse = {
  tour?: AdminTourValues;
  errorZh?: string;
  fieldErrors?: AdminTourFieldErrors;
};

const STATUS_LABELS: Record<AdminTourStatus, string> = {
  draft: "草稿",
  published: "已发布",
  archived: "已归档",
};

const ADMIN_TOUR_STATUSES: AdminTourStatus[] = ["draft", "published", "archived"];
const TOUR_IMAGE_OPTIONS = getAdminImageOptions("tour");
type TextTourField = Exclude<keyof AdminTourInput, "featured" | "displayOrder" | "status">;

const TEXT_FIELDS: Array<{ field: TextTourField; label: string; maxLength: number; multiline?: boolean; wide?: boolean }> = [
  { field: "slug", label: "线路 slug", maxLength: 80 },
  { field: "titleZh", label: "中文标题", maxLength: 100 },
  { field: "titleEn", label: "英文标题", maxLength: 160 },
  { field: "descriptionZh", label: "中文介绍", maxLength: 1000, multiline: true, wide: true },
  { field: "descriptionEn", label: "英文介绍", maxLength: 1500, multiline: true, wide: true },
  { field: "durationZh", label: "中文行程时长", maxLength: 50 },
  { field: "durationEn", label: "英文行程时长", maxLength: 80 },
  { field: "tagZh", label: "中文标签", maxLength: 30 },
  { field: "tagEn", label: "英文标签", maxLength: 50 },
  { field: "priceTextZh", label: "中文价格文字", maxLength: 60 },
  { field: "priceTextEn", label: "英文价格文字", maxLength: 100 },
  { field: "imageAltZh", label: "中文图片替代文字", maxLength: 160 },
  { field: "imageAltEn", label: "英文图片替代文字", maxLength: 220 },
];

function emptyTour(): AdminTourInput {
  return {
    slug: "",
    titleZh: "",
    titleEn: "",
    descriptionZh: "",
    descriptionEn: "",
    durationZh: "",
    durationEn: "",
    tagZh: "",
    tagEn: "",
    priceTextZh: "",
    priceTextEn: "",
    imageUrl: "",
    imageAltZh: "",
    imageAltEn: "",
    featured: false,
    displayOrder: 0,
    status: "draft",
  };
}

function toTourInput(tour: AdminTourValues): AdminTourInput {
  return {
    slug: tour.slug,
    titleZh: tour.titleZh,
    titleEn: tour.titleEn,
    descriptionZh: tour.descriptionZh,
    descriptionEn: tour.descriptionEn,
    durationZh: tour.durationZh,
    durationEn: tour.durationEn,
    tagZh: tour.tagZh,
    tagEn: tour.tagEn,
    priceTextZh: tour.priceTextZh,
    priceTextEn: tour.priceTextEn,
    imageUrl: tour.imageUrl,
    imageAltZh: tour.imageAltZh,
    imageAltEn: tour.imageAltEn,
    featured: tour.featured,
    displayOrder: tour.displayOrder,
    status: tour.status,
  };
}

function cloneInput(values: AdminTourInput): AdminTourInput {
  return { ...values };
}

function sortTours(tours: AdminTourValues[]) {
  return [...tours].sort((left, right) => left.displayOrder - right.displayOrder || left.id.localeCompare(right.id));
}

function isAdminTourValues(value: unknown): value is AdminTourValues {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return typeof record.id === "string" && typeof record.slug === "string" && typeof record.titleZh === "string" && typeof record.titleEn === "string" && typeof record.descriptionZh === "string" && typeof record.descriptionEn === "string" && typeof record.featured === "boolean" && typeof record.displayOrder === "number" && typeof record.status === "string";
}

export function confirmAdminTourNavigation(isDirty: boolean) {
  return !isDirty || window.confirm("有未保存的线路修改，确定离开旅游线路管理吗？");
}

export function AdminTourManager({ initialValues }: { initialValues: AdminTourValues[] }) {
  const router = useRouter();
  const initialDrafts = Object.fromEntries(initialValues.map((tour) => [tour.id, toTourInput(tour)]));
  const [tours, setTours] = useState<AdminTourValues[]>(() => sortTours(initialValues));
  const [newValues, setNewValues] = useState<AdminTourInput>(() => emptyTour());
  const [newBaseline, setNewBaseline] = useState<AdminTourInput>(() => emptyTour());
  const [drafts, setDrafts] = useState<Record<string, AdminTourInput>>(initialDrafts);
  const [baselineDrafts, setBaselineDrafts] = useState<Record<string, AdminTourInput>>(initialDrafts);
  const [formErrors, setFormErrors] = useState<Record<string, AdminTourFieldErrors>>({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const isNewDirty = JSON.stringify(newValues) !== JSON.stringify(newBaseline);
  const isDirty = isNewDirty || JSON.stringify(drafts) !== JSON.stringify(baselineDrafts);
  const pending = pendingKey !== null;

  useEffect(() => {
    if (!isDirty) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  useEffect(() => {
    if (!isDirty) return;
    const guardedUrl = window.location.href;
    let allowNavigation = false;
    window.history.pushState({ ...window.history.state, adminTourGuard: true }, "", guardedUrl);
    const handlePopState = () => {
      if (allowNavigation) return;
      if (window.confirm("有未保存的线路修改，确定离开旅游线路管理吗？")) {
        allowNavigation = true;
        window.history.back();
      } else {
        window.history.pushState({ ...window.history.state, adminTourGuard: true }, "", guardedUrl);
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [isDirty]);

  function setFormError(formKey: string, fieldErrors: AdminTourFieldErrors = {}) {
    setFormErrors((current) => ({ ...current, [formKey]: fieldErrors }));
  }

  function updateField(formKey: string, field: keyof AdminTourInput, value: string | number | boolean) {
    if (formKey === "new") setNewValues((current) => ({ ...current, [field]: value } as AdminTourInput));
    else setDrafts((current) => ({ ...current, [formKey]: { ...current[formKey], [field]: value } as AdminTourInput }));
    setFormErrors((current) => {
      const next = { ...current, [formKey]: { ...(current[formKey] ?? {}) } };
      delete next[formKey][field];
      return next;
    });
    setError("");
    setSuccess("");
    setSessionExpired(false);
  }

  function handleReturn(event: MouseEvent<HTMLAnchorElement>) {
    if (!confirmAdminTourNavigation(isDirty)) event.preventDefault();
  }

  function handleNewCancel() {
    if (!confirmAdminTourNavigation(isNewDirty)) return;
    const reset = emptyTour();
    setNewValues(reset);
    setNewBaseline(cloneInput(reset));
    setFormError("new");
  }

  function handleEditCancel(tourId: string) {
    const tourDirty = JSON.stringify(drafts[tourId]) !== JSON.stringify(baselineDrafts[tourId]);
    if (!confirmAdminTourNavigation(tourDirty)) return;
    setDrafts((current) => ({ ...current, [tourId]: cloneInput(baselineDrafts[tourId]) }));
    setFormError(tourId);
  }

  async function readResponse(response: Response) {
    return await response.json().catch(() => ({})) as AdminTourResponse;
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pendingKey) return;
    setPendingKey("new");
    setError("");
    setSuccess("");
    setFormError("new");
    setSessionExpired(false);
    try {
      const response = await fetch("/api/admin/tours", { method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store", body: JSON.stringify(newValues) });
      const result = await readResponse(response);
      if (response.status === 401) {
        setSessionExpired(true);
        setError(result.errorZh || "登录状态已失效，请重新登录。");
      } else if (!response.ok) {
        setError(result.errorZh || "线路保存失败，请检查填写内容后重试。");
        setFormError("new", result.fieldErrors || {});
      } else if (!isAdminTourValues(result.tour)) {
        setError("服务器返回的线路格式不正确。");
      } else {
        const nextTours = sortTours([...tours, result.tour]);
        const nextInput = toTourInput(result.tour);
        setTours(nextTours);
        setDrafts((current) => ({ ...current, [result.tour!.id]: nextInput }));
        setBaselineDrafts((current) => ({ ...current, [result.tour!.id]: cloneInput(nextInput) }));
        const reset = emptyTour();
        setNewValues(reset);
        setNewBaseline(cloneInput(reset));
        setSuccess("旅游线路已新增");
        router.refresh();
      }
    } catch {
      setError("线路保存失败，请检查网络后重试。");
    } finally {
      setPendingKey(null);
    }
  }

  async function handleUpdate(event: FormEvent<HTMLFormElement>, tourId: string) {
    event.preventDefault();
    if (pendingKey) return;
    const values = drafts[tourId];
    if (!values) return;
    setPendingKey(tourId);
    setError("");
    setSuccess("");
    setFormError(tourId);
    setSessionExpired(false);
    try {
      const response = await fetch(`/api/admin/tours/${encodeURIComponent(tourId)}`, { method: "PUT", headers: { "Content-Type": "application/json" }, cache: "no-store", body: JSON.stringify(values) });
      const result = await readResponse(response);
      if (response.status === 401) {
        setSessionExpired(true);
        setError(result.errorZh || "登录状态已失效，请重新登录。");
      } else if (!response.ok) {
        setError(result.errorZh || "线路保存失败，请检查填写内容后重试。");
        setFormError(tourId, result.fieldErrors || {});
      } else if (!isAdminTourValues(result.tour)) {
        setError("服务器返回的线路格式不正确。");
      } else {
        const nextInput = toTourInput(result.tour);
        setTours((current) => sortTours(current.map((tour) => tour.id === tourId ? result.tour! : tour)));
        setDrafts((current) => ({ ...current, [tourId]: nextInput }));
        setBaselineDrafts((current) => ({ ...current, [tourId]: cloneInput(nextInput) }));
        setSuccess("旅游线路已保存");
        router.refresh();
      }
    } catch {
      setError("线路保存失败，请检查网络后重试。");
    } finally {
      setPendingKey(null);
    }
  }

  function renderTextField(formKey: string, values: AdminTourInput, definition: typeof TEXT_FIELDS[number]) {
    const errorKey = formErrors[formKey]?.[definition.field];
    const id = `tour-${formKey}-${definition.field}`;
    const commonProps = {
      id,
      name: id,
      value: values[definition.field],
      maxLength: definition.maxLength,
      disabled: pending,
      "aria-invalid": Boolean(errorKey),
      "aria-describedby": errorKey ? `${id}-error` : undefined,
      onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => updateField(formKey, definition.field, event.target.value),
    };
    return <div className={`admin-tour-field${definition.wide ? " admin-tour-field-wide" : ""}`} key={definition.field}><label htmlFor={id}>{definition.label}<span>最多 {definition.maxLength} 个字符</span></label>{definition.multiline ? <textarea {...commonProps} rows={5} /> : <input {...commonProps} type="text" autoComplete="off" />}{errorKey ? <p id={`${id}-error`} className="admin-field-error" role="alert">{errorKey}</p> : null}</div>;
  }

  function renderForm(values: AdminTourInput, formKey: string, isNew: boolean, tourId?: string) {
    const imageError = formErrors[formKey]?.imageUrl;
    const imageId = `tour-${formKey}-imageUrl`;
    const statusError = formErrors[formKey]?.status;
    const displayOrderError = formErrors[formKey]?.displayOrder;
    const featuredError = formErrors[formKey]?.featured;
    const isFormDirty = isNew ? isNewDirty : JSON.stringify(values) !== JSON.stringify(baselineDrafts[formKey]);
    return <form className="admin-tour-form" aria-busy={pendingKey === formKey} onSubmit={(event) => { if (isNew) void handleCreate(event); else if (tourId) void handleUpdate(event, tourId); }}>
      {TEXT_FIELDS.filter((definition) => definition.field !== "imageAltZh" && definition.field !== "imageAltEn").map((definition) => renderTextField(formKey, values, definition))}
      <div className="admin-tour-field admin-tour-field-wide"><label htmlFor={imageId}>线路图片</label><select id={imageId} name={imageId} value={values.imageUrl} disabled={pending} aria-invalid={Boolean(imageError)} aria-describedby={imageError ? `${imageId}-error` : undefined} onChange={(event) => updateField(formKey, "imageUrl", event.target.value)}><option value="">不选择图片</option>{TOUR_IMAGE_OPTIONS.map((image) => <option value={image.path} key={image.path}>{image.labelZh} / {image.labelEn}</option>)}</select>{imageError ? <p id={`${imageId}-error`} className="admin-field-error" role="alert">{imageError}</p> : null}{values.imageUrl ? <AdminImagePreview src={values.imageUrl} alt={values.imageAltZh || values.titleZh || "线路图片预览"} /> : <p className="admin-tour-no-image">未选择图片，首页卡片会安全显示文字内容。</p>}</div>
      {TEXT_FIELDS.filter((definition) => definition.field === "imageAltZh" || definition.field === "imageAltEn").map((definition) => renderTextField(formKey, values, definition))}
      <div className="admin-tour-field"><label htmlFor={`tour-${formKey}-displayOrder`}>显示顺序<span>0 到 1000 的整数</span></label><input id={`tour-${formKey}-displayOrder`} name={`tour-${formKey}-displayOrder`} type="number" min={0} max={1000} step={1} value={values.displayOrder} disabled={pending} aria-invalid={Boolean(displayOrderError)} aria-describedby={displayOrderError ? `tour-${formKey}-displayOrder-error` : undefined} onChange={(event) => updateField(formKey, "displayOrder", Number(event.target.value))} />{displayOrderError ? <p id={`tour-${formKey}-displayOrder-error`} className="admin-field-error" role="alert">{displayOrderError}</p> : null}</div>
      <div className="admin-tour-field"><label htmlFor={`tour-${formKey}-status`}>状态</label><select id={`tour-${formKey}-status`} name={`tour-${formKey}-status`} value={values.status} disabled={pending} aria-invalid={Boolean(statusError)} aria-describedby={statusError ? `tour-${formKey}-status-error` : undefined} onChange={(event) => updateField(formKey, "status", event.target.value)}>{ADMIN_TOUR_STATUSES.map((status) => <option value={status} key={status}>{STATUS_LABELS[status]}</option>)}</select>{statusError ? <p id={`tour-${formKey}-status-error`} className="admin-field-error" role="alert">{statusError}</p> : null}</div>
      <div className="admin-tour-field admin-tour-featured-field"><label htmlFor={`tour-${formKey}-featured`}>首页推荐</label><label className="admin-checkbox-label"><input id={`tour-${formKey}-featured`} name={`tour-${formKey}-featured`} type="checkbox" checked={values.featured} disabled={pending} aria-invalid={Boolean(featuredError)} onChange={(event) => updateField(formKey, "featured", event.target.checked)} />在首页推荐区显示</label>{featuredError ? <p className="admin-field-error" role="alert">{featuredError}</p> : null}</div>
      <div className="admin-profile-actions"><button className="button button-dark" type="submit" disabled={pending || !isFormDirty}>{pendingKey === formKey ? "保存中……" : isNew ? "新增线路" : "保存线路"}</button><button className="button button-light" type="button" disabled={pending} onClick={() => isNew ? handleNewCancel() : tourId ? handleEditCancel(tourId) : undefined}>{isNew ? "清空新增表单" : "取消修改"}</button></div>
    </form>;
  }

  return <main className="admin-page">
    <header className="admin-topbar"><Link className="admin-brand" href="/admin" onClick={handleReturn}><span className="brand-mark">Q</span><span><strong>QIANLIN TRAVEL</strong><small>旅游线路管理</small></span></Link><div className="admin-topbar-actions"><Link className="admin-profile-back-link" href="/admin" onClick={handleReturn}>返回后台</Link><AdminLogoutButton isDirty={isDirty} disabled={pending} /></div></header>
    <div className="admin-shell admin-tours-shell">
      <div className="admin-heading"><div><span className="eyebrow">QIANLIN TRAVEL · TOURS</span><h1>旅游线路管理</h1><p>新增或编辑官网线路。价格、时长和标签均为展示文字，线路图片只能从项目内置白名单中选择。</p></div></div>
      <p className="admin-tour-status" role="status" aria-live="polite">{pending ? "正在保存线路……" : "线路数据已加载"}{sessionExpired ? <Link href="/admin/login">重新登录</Link> : null}</p>
      {error ? <div className="admin-form-error" role="alert">{error}</div> : null}
      {success ? <p className="admin-save-success" role="status">{success}</p> : null}
      <section className="admin-card admin-tours-card"><div className="admin-card-heading"><div><span className="eyebrow">NEW TOUR</span><h2>新增线路</h2></div><span className="admin-image-count">服务端生成线路 ID</span></div>{renderForm(newValues, "new", true)}</section>
      <section className="admin-card admin-tours-card"><div className="admin-card-heading"><div><span className="eyebrow">TOUR LIST</span><h2>已有线路</h2></div><span className="admin-image-count">{tours.length} 条记录</span></div>{tours.length === 0 ? <p className="admin-tour-empty">当前还没有线路。可以先从上方新增一条虚构或已确认的线路资料。</p> : <div className="admin-tour-list">{tours.map((tour, index) => <article className="admin-tour-card" key={tour.id}><div className="admin-tour-card-heading"><div><span className="eyebrow">TOUR {String(index + 1).padStart(2, "0")}</span><h3>{tour.titleZh}</h3><p>{tour.titleEn} · {tour.slug}</p></div><span className={`admin-tour-status admin-tour-status-${tour.status}`}>{STATUS_LABELS[tour.status]}</span></div>{renderForm(drafts[tour.id], tour.id, false, tour.id)}</article>)}</div>}</section>
    </div>
  </main>;
}
