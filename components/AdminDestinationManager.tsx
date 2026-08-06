"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ChangeEvent, FormEvent, MouseEvent } from "react";
import { useMemo, useState } from "react";
import { getAdminImageOptions } from "../lib/admin/imageCatalog";
import type { AdminCityOption, AdminDestinationCardSize, AdminDestinationFieldErrors, AdminDestinationInput, AdminDestinationStatus, AdminDestinationValues } from "../lib/admin/destinations";
import { AdminImagePreview } from "./AdminImagePreview";
import { AdminLogoutButton } from "./AdminDashboard";
import { confirmAdminNavigation, useAdminUnsavedChanges } from "./useAdminUnsavedChanges";

type AdminDestinationResponse = {
  destination?: AdminDestinationValues;
  errorZh?: string;
  fieldErrors?: AdminDestinationFieldErrors;
};

const STATUS_LABELS: Record<AdminDestinationStatus, string> = {
  draft: "草稿",
  published: "已发布",
  archived: "已归档",
};

const STATUS_FILTERS: Array<AdminDestinationStatus | "all"> = ["all", "published", "draft", "archived"];
const STATUS_FILTER_LABELS: Record<AdminDestinationStatus | "all", string> = { all: "全部状态", ...STATUS_LABELS };
const CARD_SIZE_LABELS: Record<AdminDestinationCardSize, string> = { small: "小卡片", large: "大卡片" };
const IMAGE_OPTIONS = getAdminImageOptions("destination");
type TextDestinationField = Exclude<keyof AdminDestinationInput, "cityCode" | "imageUrl" | "cardSize" | "routeOrder" | "recommendedVisitHours" | "majorAttraction" | "availableForPlanning" | "showOnHomepage" | "displayOrder" | "status">;

const TEXT_FIELDS: Array<{ field: TextDestinationField; label: string; maxLength: number; multiline?: boolean; wide?: boolean }> = [
  { field: "slug", label: "目的地 slug", maxLength: 80 },
  { field: "nameZh", label: "中文名称", maxLength: 100 },
  { field: "nameEn", label: "英文名称", maxLength: 160 },
  { field: "descriptionZh", label: "中文介绍", maxLength: 1000, multiline: true, wide: true },
  { field: "descriptionEn", label: "英文介绍", maxLength: 1500, multiline: true, wide: true },
  { field: "regionZh", label: "中文区域名称", maxLength: 160 },
  { field: "regionEn", label: "英文区域名称", maxLength: 160 },
  { field: "overnightZh", label: "中文住宿建议", maxLength: 160 },
  { field: "overnightEn", label: "英文住宿建议", maxLength: 240 },
];

function emptyDestination(): AdminDestinationInput {
  return {
    slug: "",
    cityCode: "",
    nameZh: "",
    nameEn: "",
    descriptionZh: "",
    descriptionEn: "",
    imageUrl: "",
    cardSize: "small",
    regionZh: "",
    regionEn: "",
    routeOrder: 0,
    overnightZh: "",
    overnightEn: "",
    recommendedVisitHours: null,
    majorAttraction: false,
    availableForPlanning: true,
    showOnHomepage: false,
    displayOrder: 0,
    status: "draft",
  };
}

function toDestinationInput(destination: AdminDestinationValues): AdminDestinationInput {
  return {
    slug: destination.slug,
    cityCode: destination.cityCode,
    nameZh: destination.nameZh,
    nameEn: destination.nameEn,
    descriptionZh: destination.descriptionZh,
    descriptionEn: destination.descriptionEn,
    imageUrl: destination.imageUrl,
    cardSize: destination.cardSize,
    regionZh: destination.regionZh,
    regionEn: destination.regionEn,
    routeOrder: destination.routeOrder,
    overnightZh: destination.overnightZh,
    overnightEn: destination.overnightEn,
    recommendedVisitHours: destination.recommendedVisitHours,
    majorAttraction: destination.majorAttraction,
    availableForPlanning: destination.availableForPlanning,
    showOnHomepage: destination.showOnHomepage,
    displayOrder: destination.displayOrder,
    status: destination.status,
  };
}

function cloneInput(values: AdminDestinationInput) {
  return { ...values };
}

function sortDestinations(destinations: AdminDestinationValues[]) {
  return [...destinations].sort((left, right) => left.displayOrder - right.displayOrder || left.id.localeCompare(right.id));
}

function isAdminDestinationValues(value: unknown): value is AdminDestinationValues {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return typeof record.id === "string" && typeof record.slug === "string" && typeof record.cityCode === "string" && typeof record.nameZh === "string" && typeof record.nameEn === "string" && typeof record.descriptionZh === "string" && typeof record.descriptionEn === "string" && typeof record.imageUrl === "string" && (record.cardSize === "small" || record.cardSize === "large") && typeof record.regionZh === "string" && typeof record.regionEn === "string" && typeof record.routeOrder === "number" && (record.recommendedVisitHours === null || typeof record.recommendedVisitHours === "number") && typeof record.majorAttraction === "boolean" && typeof record.availableForPlanning === "boolean" && typeof record.showOnHomepage === "boolean" && typeof record.displayOrder === "number" && typeof record.status === "string";
}

function cityLabel(city: AdminCityOption) {
  return `${city.nameZh} / ${city.nameEn}`;
}

export function AdminDestinationManager({ initialValues, cityOptions }: { initialValues: AdminDestinationValues[]; cityOptions: AdminCityOption[] }) {
  const router = useRouter();
  const initialDrafts = Object.fromEntries(initialValues.map((destination) => [destination.id, toDestinationInput(destination)]));
  const [destinations, setDestinations] = useState<AdminDestinationValues[]>(() => sortDestinations(initialValues));
  const [drafts, setDrafts] = useState<Record<string, AdminDestinationInput>>(initialDrafts);
  const [baselineDrafts, setBaselineDrafts] = useState<Record<string, AdminDestinationInput>>(initialDrafts);
  const [newValues, setNewValues] = useState<AdminDestinationInput>(() => emptyDestination());
  const [newBaseline, setNewBaseline] = useState<AdminDestinationInput>(() => emptyDestination());
  const [showNew, setShowNew] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<AdminDestinationStatus | "all">("all");
  const [formErrors, setFormErrors] = useState<Record<string, AdminDestinationFieldErrors>>({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);

  const newDirty = showNew && JSON.stringify(newValues) !== JSON.stringify(newBaseline);
  const activeDirty = activeId ? JSON.stringify(drafts[activeId]) !== JSON.stringify(baselineDrafts[activeId]) : false;
  const isDirty = newDirty || activeDirty;
  const pending = pendingKey !== null;
  const visibleDestinations = useMemo(() => destinations.filter((destination) => statusFilter === "all" || destination.status === statusFilter), [destinations, statusFilter]);

  useAdminUnsavedChanges(isDirty, "有未保存的目的地修改，确定离开目的地管理吗？");

  function setFormError(formKey: string, fieldErrors: AdminDestinationFieldErrors = {}) {
    setFormErrors((current) => ({ ...current, [formKey]: fieldErrors }));
  }

  function updateField(formKey: string, field: keyof AdminDestinationInput, value: string | number | boolean | null) {
    if (formKey === "new") setNewValues((current) => ({ ...current, [field]: value } as AdminDestinationInput));
    else setDrafts((current) => ({ ...current, [formKey]: { ...current[formKey], [field]: value } as AdminDestinationInput }));
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
    if (!confirmAdminNavigation(isDirty, "有未保存的目的地修改，确定返回后台吗？")) event.preventDefault();
  }

  function handleOpenNew() {
    if (!confirmAdminNavigation(isDirty, "有未保存的目的地修改，确定切换编辑区域吗？")) return;
    setShowNew(true);
    setActiveId(null);
    setError("");
    setSuccess("");
  }

  function handleNewCancel() {
    if (!confirmAdminNavigation(newDirty, "有未保存的新增目的地，确定取消吗？")) return;
    const reset = emptyDestination();
    setNewValues(reset);
    setNewBaseline(cloneInput(reset));
    setShowNew(false);
    setFormError("new");
  }

  function handleOpenEdit(destinationId: string) {
    if (!confirmAdminNavigation(isDirty, "有未保存的目的地修改，确定切换编辑区域吗？")) return;
    setShowNew(false);
    setActiveId(destinationId);
    setError("");
    setSuccess("");
  }

  function handleEditCancel() {
    if (!activeId) return;
    if (!confirmAdminNavigation(activeDirty, "有未保存的目的地修改，确定取消吗？")) return;
    setDrafts((current) => ({ ...current, [activeId]: cloneInput(baselineDrafts[activeId]) }));
    setFormError(activeId);
    setActiveId(null);
  }

  async function readResponse(response: Response) {
    return await response.json().catch(() => ({})) as AdminDestinationResponse;
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
      const response = await fetch("/api/admin/destinations", { method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store", body: JSON.stringify(newValues) });
      const result = await readResponse(response);
      if (response.status === 401) {
        setSessionExpired(true);
        setError(result.errorZh || "登录状态已失效，请重新登录。");
      } else if (!response.ok) {
        setError(result.errorZh || "目的地保存失败，请检查填写内容后重试。");
        setFormError("new", result.fieldErrors || {});
      } else if (!isAdminDestinationValues(result.destination)) {
        setError("服务器返回的目的地格式不正确。");
      } else {
        const nextDestination = result.destination;
        setDestinations((current) => sortDestinations([...current, nextDestination]));
        setDrafts((current) => ({ ...current, [nextDestination.id]: toDestinationInput(nextDestination) }));
        setBaselineDrafts((current) => ({ ...current, [nextDestination.id]: toDestinationInput(nextDestination) }));
        const reset = emptyDestination();
        setNewValues(reset);
        setNewBaseline(cloneInput(reset));
        setShowNew(false);
        setSuccess("目的地已新增");
        router.refresh();
      }
    } catch {
      setError("目的地保存失败，请检查网络后重试。");
    } finally {
      setPendingKey(null);
    }
  }

  async function handleUpdate(event: FormEvent<HTMLFormElement>, destinationId: string) {
    event.preventDefault();
    if (pendingKey) return;
    const values = drafts[destinationId];
    if (!values) return;
    setPendingKey(destinationId);
    setError("");
    setSuccess("");
    setFormError(destinationId);
    setSessionExpired(false);
    try {
      const response = await fetch(`/api/admin/destinations/${encodeURIComponent(destinationId)}`, { method: "PUT", headers: { "Content-Type": "application/json" }, cache: "no-store", body: JSON.stringify(values) });
      const result = await readResponse(response);
      if (response.status === 401) {
        setSessionExpired(true);
        setError(result.errorZh || "登录状态已失效，请重新登录。");
      } else if (!response.ok) {
        setError(result.errorZh || "目的地保存失败，请检查填写内容后重试。");
        setFormError(destinationId, result.fieldErrors || {});
      } else if (!isAdminDestinationValues(result.destination)) {
        setError("服务器返回的目的地格式不正确。");
      } else {
        const nextInput = toDestinationInput(result.destination);
        setDestinations((current) => sortDestinations(current.map((destination) => destination.id === destinationId ? result.destination! : destination)));
        setDrafts((current) => ({ ...current, [destinationId]: nextInput }));
        setBaselineDrafts((current) => ({ ...current, [destinationId]: cloneInput(nextInput) }));
        setSuccess("目的地已保存");
        router.refresh();
      }
    } catch {
      setError("目的地保存失败，请检查网络后重试。");
    } finally {
      setPendingKey(null);
    }
  }

  function renderTextField(formKey: string, values: AdminDestinationInput, definition: typeof TEXT_FIELDS[number]) {
    const errorKey = formErrors[formKey]?.[definition.field];
    const id = `destination-${formKey}-${definition.field}`;
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
    return <div className={`admin-destination-field${definition.wide ? " admin-destination-field-wide" : ""}`} key={definition.field}><label htmlFor={id}>{definition.label}<span>最多 {definition.maxLength} 个字符</span></label>{definition.multiline ? <textarea {...commonProps} rows={5} /> : <input {...commonProps} type="text" autoComplete="off" />}{errorKey ? <p id={`${id}-error`} className="admin-field-error" role="alert">{errorKey}</p> : null}</div>;
  }

  function renderForm(values: AdminDestinationInput, formKey: string, isNew: boolean, destinationId?: string) {
    const errors = formErrors[formKey] ?? {};
    const cityId = `destination-${formKey}-cityCode`;
    const imageId = `destination-${formKey}-imageUrl`;
    const cardSizeId = `destination-${formKey}-cardSize`;
    const routeOrderId = `destination-${formKey}-routeOrder`;
    const visitHoursId = `destination-${formKey}-recommendedVisitHours`;
    const displayOrderId = `destination-${formKey}-displayOrder`;
    const statusId = `destination-${formKey}-status`;
    const formIsDirty = isNew ? newDirty : JSON.stringify(values) !== JSON.stringify(baselineDrafts[formKey]);
    const setNumber = (field: "routeOrder" | "displayOrder", rawValue: string) => updateField(formKey, field, rawValue === "" ? Number.NaN : Number(rawValue));
    return <form className="admin-destination-form" aria-busy={pendingKey === formKey} onSubmit={(event) => { if (isNew) void handleCreate(event); else if (destinationId) void handleUpdate(event, destinationId); }}>
      {TEXT_FIELDS.map((definition) => renderTextField(formKey, values, definition))}
      <div className="admin-destination-field"><label htmlFor={`destination-${formKey}-province`}>所属省份</label><output id={`destination-${formKey}-province`} className="admin-destination-readonly">贵州 / Guizhou</output><p className="admin-destination-help">当前版本固定管理贵州目的地，省份由服务端控制。</p></div>
      <div className="admin-destination-field"><label htmlFor={cityId}>所属城市</label><select id={cityId} name={cityId} value={values.cityCode} disabled={pending} aria-invalid={Boolean(errors.cityCode)} aria-describedby={errors.cityCode ? `${cityId}-error` : undefined} onChange={(event) => updateField(formKey, "cityCode", event.target.value)}><option value="">未设置城市</option>{cityOptions.map((city) => <option value={city.code} key={city.code}>{cityLabel(city)}</option>)}</select>{errors.cityCode ? <p id={`${cityId}-error`} className="admin-field-error" role="alert">{errors.cityCode}</p> : null}</div>
      <div className="admin-destination-field admin-destination-field-wide"><label htmlFor={imageId}>目的地图片</label><select id={imageId} name={imageId} value={values.imageUrl} disabled={pending} aria-invalid={Boolean(errors.imageUrl)} aria-describedby={errors.imageUrl ? `${imageId}-error` : undefined} onChange={(event) => updateField(formKey, "imageUrl", event.target.value)}><option value="">不选择图片</option>{IMAGE_OPTIONS.map((image) => <option value={image.path} key={image.path}>{image.labelZh} / {image.labelEn}</option>)}</select>{errors.imageUrl ? <p id={`${imageId}-error`} className="admin-field-error" role="alert">{errors.imageUrl}</p> : null}{values.imageUrl ? <AdminImagePreview src={values.imageUrl} alt={values.nameZh || "目的地图片预览"} /> : <p className="admin-destination-help">关闭首页展示时可以不选择图片，开启首页展示必须选择白名单图片。</p>}</div>
      <div className="admin-destination-field"><label htmlFor={cardSizeId}>首页卡片大小</label><select id={cardSizeId} name={cardSizeId} value={values.cardSize} disabled={pending} aria-invalid={Boolean(errors.cardSize)} aria-describedby={errors.cardSize ? `${cardSizeId}-error` : undefined} onChange={(event) => updateField(formKey, "cardSize", event.target.value)}><option value="small">{CARD_SIZE_LABELS.small}</option><option value="large">{CARD_SIZE_LABELS.large}</option></select>{errors.cardSize ? <p id={`${cardSizeId}-error`} className="admin-field-error" role="alert">{errors.cardSize}</p> : null}</div>
      <div className="admin-destination-field"><label htmlFor={routeOrderId}>规划线路顺序<span>0 到 1000 的整数</span></label><input id={routeOrderId} name={routeOrderId} type="number" min={0} max={1000} step={1} value={Number.isNaN(values.routeOrder) ? "" : values.routeOrder} disabled={pending} aria-invalid={Boolean(errors.routeOrder)} aria-describedby={errors.routeOrder ? `${routeOrderId}-error` : undefined} onChange={(event) => setNumber("routeOrder", event.target.value)} />{errors.routeOrder ? <p id={`${routeOrderId}-error`} className="admin-field-error" role="alert">{errors.routeOrder}</p> : null}</div>
      <div className="admin-destination-field"><label htmlFor={visitHoursId}>建议游览时长<span>空值或 1 到 48 小时</span></label><input id={visitHoursId} name={visitHoursId} type="number" min={1} max={48} step={1} value={values.recommendedVisitHours ?? ""} disabled={pending} aria-invalid={Boolean(errors.recommendedVisitHours)} aria-describedby={errors.recommendedVisitHours ? `${visitHoursId}-error` : undefined} onChange={(event) => updateField(formKey, "recommendedVisitHours", event.target.value === "" ? null : Number(event.target.value))} />{errors.recommendedVisitHours ? <p id={`${visitHoursId}-error`} className="admin-field-error" role="alert">{errors.recommendedVisitHours}</p> : null}</div>
      <div className="admin-destination-field"><label htmlFor={displayOrderId}>首页显示顺序<span>0 到 1000 的整数</span></label><input id={displayOrderId} name={displayOrderId} type="number" min={0} max={1000} step={1} value={Number.isNaN(values.displayOrder) ? "" : values.displayOrder} disabled={pending} aria-invalid={Boolean(errors.displayOrder)} aria-describedby={errors.displayOrder ? `${displayOrderId}-error` : undefined} onChange={(event) => setNumber("displayOrder", event.target.value)} />{errors.displayOrder ? <p id={`${displayOrderId}-error`} className="admin-field-error" role="alert">{errors.displayOrder}</p> : null}</div>
      <div className="admin-destination-field"><label htmlFor={statusId}>状态</label><select id={statusId} name={statusId} value={values.status} disabled={pending} aria-invalid={Boolean(errors.status)} aria-describedby={errors.status ? `${statusId}-error` : undefined} onChange={(event) => updateField(formKey, "status", event.target.value)}>{STATUS_FILTERS.filter((status): status is AdminDestinationStatus => status !== "all").map((status) => <option value={status} key={status}>{STATUS_LABELS[status]}</option>)}</select>{errors.status ? <p id={`${statusId}-error`} className="admin-field-error" role="alert">{errors.status}</p> : null}</div>
      <div className="admin-destination-field admin-destination-checkboxes"><label>目的地属性</label><label className="admin-checkbox-label"><input type="checkbox" checked={values.majorAttraction} disabled={pending} onChange={(event) => updateField(formKey, "majorAttraction", event.target.checked)} />主要景点</label><label className="admin-checkbox-label"><input type="checkbox" checked={values.availableForPlanning} disabled={pending} onChange={(event) => updateField(formKey, "availableForPlanning", event.target.checked)} />参与行程规划</label><label className="admin-checkbox-label"><input type="checkbox" checked={values.showOnHomepage} disabled={pending} onChange={(event) => updateField(formKey, "showOnHomepage", event.target.checked)} />首页展示</label>{errors.majorAttraction || errors.availableForPlanning || errors.showOnHomepage ? <p className="admin-field-error" role="alert">请检查目的地属性设置。</p> : null}</div>
      <div className="admin-profile-actions admin-destination-actions"><button className="button button-dark" type="submit" disabled={pending || !formIsDirty}>{pendingKey === formKey ? "保存中……" : isNew ? "新增目的地" : "保存目的地"}</button><button className="button button-light" type="button" disabled={pending} onClick={isNew ? handleNewCancel : handleEditCancel}>{isNew ? "取消新增" : "取消修改"}</button></div>
    </form>;
  }

  return <main className="admin-page">
    <header className="admin-topbar"><Link className="admin-brand" href="/admin" onClick={handleReturn}><span className="brand-mark">Q</span><span><strong>QIANLIN TRAVEL</strong><small>目的地管理</small></span></Link><div className="admin-topbar-actions"><Link className="admin-profile-back-link" href="/admin" onClick={handleReturn}>返回后台</Link><AdminLogoutButton isDirty={isDirty} disabled={pending} /></div></header>
    <div className="admin-shell admin-destinations-shell">
      <div className="admin-heading"><div><span className="eyebrow">QIANLIN TRAVEL · DESTINATIONS</span><h1>目的地管理</h1><p>管理贵州目的地在首页和行程规划器中的展示方式。现有记录只展开单条编辑区域，图片只能从项目内置白名单中选择。</p></div></div>
      <p className="admin-tour-status" role="status" aria-live="polite">{pending ? "正在保存目的地……" : "目的地数据已加载"}{sessionExpired ? <Link href="/admin/login">重新登录</Link> : null}</p>
      {error ? <div className="admin-form-error" role="alert">{error}</div> : null}
      {success ? <p className="admin-save-success" role="status">{success}</p> : null}
      {showNew ? <section className="admin-card admin-destinations-card"><div className="admin-card-heading"><div><span className="eyebrow">NEW DESTINATION</span><h2>新增目的地</h2></div><span className="admin-image-count">服务端生成目的地 ID</span></div>{renderForm(newValues, "new", true)}</section> : <button type="button" className="button button-dark admin-destination-new-button" onClick={handleOpenNew} disabled={pending}>新增目的地</button>}
      <section className="admin-card admin-destinations-card"><div className="admin-card-heading"><div><span className="eyebrow">DESTINATION LIST</span><h2>已有目的地</h2></div><div className="admin-destination-list-controls"><label htmlFor="destination-status-filter">状态筛选</label><select id="destination-status-filter" value={statusFilter} disabled={pending} onChange={(event) => setStatusFilter(event.target.value as AdminDestinationStatus | "all")}>{STATUS_FILTERS.map((status) => <option value={status} key={status}>{STATUS_FILTER_LABELS[status]}</option>)}</select><span className="admin-image-count">{visibleDestinations.length} / {destinations.length} 条记录</span></div></div>
        {visibleDestinations.length === 0 ? <p className="admin-destination-empty">当前筛选条件下没有目的地记录。</p> : <div className="admin-destination-list">{visibleDestinations.map((destination, index) => <article className="admin-destination-summary" key={destination.id}><div className="admin-destination-summary-image">{destination.imageUrl ? <AdminImagePreview src={destination.imageUrl} alt={destination.nameZh} /> : <span>未选择图片</span>}</div><div className="admin-destination-summary-copy"><div className="admin-destination-summary-heading"><div><span className="eyebrow">DESTINATION {String(index + 1).padStart(2, "0")}</span><h3>{destination.nameZh}</h3><p>{destination.nameEn}</p></div><span className={`admin-destination-status admin-destination-status-${destination.status}`}>{STATUS_LABELS[destination.status]}</span></div><dl className="admin-destination-summary-meta"><div><dt>slug</dt><dd>{destination.slug}</dd></div><div><dt>城市</dt><dd>{destination.cityNameZh}</dd></div><div><dt>首页</dt><dd>{destination.showOnHomepage ? "展示" : "隐藏"}</dd></div><div><dt>规划</dt><dd>{destination.availableForPlanning ? "可用" : "关闭"}</dd></div><div><dt>顺序</dt><dd>{destination.displayOrder}</dd></div></dl><button type="button" className="button button-light admin-destination-edit" onClick={() => handleOpenEdit(destination.id)} disabled={pending}>{activeId === destination.id ? "正在编辑" : "编辑目的地"}</button></div></article>)}</div>}
      </section>
      {activeId && drafts[activeId] ? <section className="admin-card admin-destinations-card"><div className="admin-card-heading"><div><span className="eyebrow">EDIT DESTINATION</span><h2>{destinations.find((destination) => destination.id === activeId)?.nameZh || "编辑目的地"}</h2></div><span className="admin-image-count">只编辑当前记录</span></div>{renderForm(drafts[activeId], activeId, false, activeId)}</section> : null}
    </div>
  </main>;
}
