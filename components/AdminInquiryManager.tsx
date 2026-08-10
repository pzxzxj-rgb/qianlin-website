"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import type { AdminInquiryListResponse, AdminInquiryStatus } from "../lib/admin/inquiries";
import { adminApiPath } from "./adminPaths";

const STATUS_LABELS: Record<AdminInquiryStatus, string> = {
  new: "新咨询",
  contacted: "已联系",
  following_up: "跟进中",
  completed: "已完成",
  closed: "已关闭",
};

const STATUS_OPTIONS: Array<{ value: "" | AdminInquiryStatus; label: string }> = [
  { value: "", label: "全部状态" },
  { value: "new", label: STATUS_LABELS.new },
  { value: "contacted", label: STATUS_LABELS.contacted },
  { value: "following_up", label: STATUS_LABELS.following_up },
  { value: "completed", label: STATUS_LABELS.completed },
  { value: "closed", label: STATUS_LABELS.closed },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function formatDate(value: string) {
  return value ? value.replace("T", " ").replace("Z", "") : "未填写";
}

function statusClass(status: AdminInquiryStatus) {
  return `admin-inquiry-status admin-inquiry-status-${status}`;
}

export function AdminInquiryManager({ initialData, tenantSlug }: { initialData: AdminInquiryListResponse; tenantSlug?: string }) {
  const [data, setData] = useState(initialData);
  const [filterStatus, setFilterStatus] = useState<"" | AdminInquiryStatus>(initialData.status ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const loadData = useCallback(async (nextStatus: "" | AdminInquiryStatus, nextPage: number) => {
    setPending(true);
    setError("");
    const params = new URLSearchParams({ page: String(nextPage), pageSize: String(data.pagination.pageSize) });
    if (nextStatus) params.set("status", nextStatus);
    try {
      const response = await fetch(`${adminApiPath(tenantSlug, "/inquiries")}?${params.toString()}`, { cache: "no-store", headers: { Accept: "application/json" } });
      const result: unknown = await response.json().catch(() => null);
      if (!isRecord(result) || !response.ok || !Array.isArray(result.items) || !isRecord(result.pagination)) throw new Error(isRecord(result) && typeof result.errorZh === "string" ? result.errorZh : "咨询列表暂时无法加载，请稍后重试。");
      setData(result as AdminInquiryListResponse);
    } catch (requestError) {
      setError(requestError instanceof Error && requestError.message ? requestError.message : "咨询列表暂时无法加载，请稍后重试。");
    } finally {
      setPending(false);
    }
  }, [data.pagination.pageSize, tenantSlug]);

  const handleFilterChange = (value: "" | AdminInquiryStatus) => {
    setFilterStatus(value);
    void loadData(value, 1);
  };

  const handlePageChange = (page: number) => {
    if (page < 1 || page > data.pagination.totalPages || pending) return;
    void loadData(filterStatus, page);
  };

  return <main className="admin-page">
    <header className="admin-topbar"><Link className="admin-brand" href="/admin"><span className="brand-mark">Q</span><span><strong>Qianlin Travel</strong><small>管理后台</small></span></Link><div className="admin-topbar-actions"><Link className="admin-topbar-link" href="/admin">返回后台</Link></div></header>
    <div className="admin-shell admin-inquiries-shell">
      <div className="admin-heading"><div><span className="eyebrow">INQUIRIES · QIANLIN TRAVEL</span><h1>咨询管理</h1><p>查看咨询记录、跟进状态和脱敏联系方式。完整联系方式仅在详情页显示。</p></div><Link className="button button-light admin-site-link" href="/">查看官网 <span aria-hidden="true">→</span></Link></div>
      <section className="admin-card admin-inquiry-list-card">
        <div className="admin-card-heading"><div><span className="eyebrow">INQUIRY LIST</span><h2>咨询记录</h2></div><span className="admin-inquiry-total">共 {data.pagination.total} 条</span></div>
        <div className="admin-inquiry-toolbar"><label htmlFor="inquiry-status-filter">状态筛选<select id="inquiry-status-filter" value={filterStatus} onChange={(event) => handleFilterChange(event.target.value as "" | AdminInquiryStatus)} disabled={pending}>{STATUS_OPTIONS.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label><span className="admin-inquiry-order">按最新提交排序</span></div>
        {error ? <p className="admin-form-error" role="alert">{error}</p> : null}
        <div className="admin-inquiry-table-wrap">
          <table className="admin-inquiry-table"><caption className="sr-only">咨询列表</caption><thead><tr><th scope="col">ID</th><th scope="col">提交时间</th><th scope="col">联系人</th><th scope="col">联系方式摘要</th><th scope="col">出行人数</th><th scope="col">出发日期</th><th scope="col">状态</th><th scope="col"><span className="sr-only">操作</span></th></tr></thead><tbody>{data.items.length === 0 ? <tr><td colSpan={8} className="admin-inquiry-empty">暂无符合条件的咨询</td></tr> : data.items.map((item) => <tr key={item.id}><td>#{item.id}</td><td>{formatDate(item.createdAt)}</td><td>{item.name}</td><td>{item.contactSummary}</td><td>{item.travelers || "未填写"}</td><td>{item.travelDate || "未填写"}</td><td><span className={statusClass(item.status)}>{STATUS_LABELS[item.status]}</span></td><td><Link className="text-link" href={`/admin/inquiries/${item.id}`}>查看详情 <span aria-hidden="true">→</span></Link></td></tr>)}</tbody></table>
        </div>
        <div className="admin-inquiry-pagination"><span>第 {data.pagination.page} / {data.pagination.totalPages} 页</span><div><button type="button" className="button button-light" onClick={() => handlePageChange(data.pagination.page - 1)} disabled={pending || data.pagination.page <= 1}>上一页</button><button type="button" className="button button-light" onClick={() => handlePageChange(data.pagination.page + 1)} disabled={pending || data.pagination.page >= data.pagination.totalPages}>下一页</button></div></div>
      </section>
    </div>
  </main>;
}

export { STATUS_LABELS };
