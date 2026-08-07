"use client";

import Link from "next/link";
import { useState } from "react";
import type { AdminInquiryDetail as AdminInquiryDetailData, AdminInquiryStatus } from "../lib/admin/inquiries";
import { STATUS_LABELS } from "./AdminInquiryManager";

const STATUS_OPTIONS: AdminInquiryStatus[] = ["new", "contacted", "following_up", "completed", "closed"];

function DetailRow({ label, value, preserveWhitespace = false }: { label: string; value: string; preserveWhitespace?: boolean }) {
  return <div className="admin-inquiry-detail-row"><dt>{label}</dt><dd className={preserveWhitespace ? "admin-inquiry-message" : undefined}>{value || "未填写"}</dd></div>;
}

export function AdminInquiryDetail({ initialInquiry }: { initialInquiry: AdminInquiryDetailData }) {
  const [inquiry, setInquiry] = useState(initialInquiry);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function updateStatus(status: AdminInquiryStatus) {
    if (pending || status === inquiry.status) return;
    setPending(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/inquiries/${inquiry.id}`, { method: "PATCH", headers: { Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.inquiry) throw new Error(typeof result?.errorZh === "string" ? result.errorZh : "咨询状态暂时无法更新，请稍后重试。");
      setInquiry((current) => ({ ...current, status: result.inquiry.status as AdminInquiryStatus }));
    } catch (requestError) {
      setError(requestError instanceof Error && requestError.message ? requestError.message : "咨询状态暂时无法更新，请稍后重试。");
    } finally {
      setPending(false);
    }
  }

  return <main className="admin-page">
    <header className="admin-topbar"><Link className="admin-brand" href="/admin"><span className="brand-mark">Q</span><span><strong>Qianlin Travel</strong><small>管理后台</small></span></Link><div className="admin-topbar-actions"><Link className="admin-topbar-link" href="/admin/inquiries">返回咨询列表</Link></div></header>
    <div className="admin-shell admin-inquiries-shell">
      <div className="admin-heading"><div><span className="eyebrow">INQUIRY #{inquiry.id}</span><h1>咨询详情</h1><p>仅登录管理员可以查看完整联系方式和留言。</p></div><Link className="button button-light admin-site-link" href="/admin/inquiries">返回列表</Link></div>
      <section className="admin-card admin-inquiry-detail-card">
        <div className="admin-card-heading"><div><span className="eyebrow">DETAIL</span><h2>{inquiry.name || "未填写姓名"}</h2></div><span className={statusClass(inquiry.status)}>{STATUS_LABELS[inquiry.status]}</span></div>
        {error ? <p className="admin-form-error" role="alert">{error}</p> : null}
        <dl className="admin-inquiry-detail-grid"><DetailRow label="姓名" value={inquiry.name} /><DetailRow label="手机" value={inquiry.phone} /><DetailRow label="微信" value={inquiry.wechat} /><DetailRow label="邮箱" value={inquiry.email} /><DetailRow label="出发日期" value={inquiry.travelDate} /><DetailRow label="出行人数" value={inquiry.travelers} /><DetailRow label="创建时间" value={inquiry.createdAt} /><DetailRow label="留言" value={inquiry.message} preserveWhitespace /></dl>
        <div className="admin-inquiry-status-editor"><label htmlFor="inquiry-detail-status">当前状态<select id="inquiry-detail-status" value={inquiry.status} onChange={(event) => void updateStatus(event.target.value as AdminInquiryStatus)} disabled={pending}>{STATUS_OPTIONS.map((status) => <option value={status} key={status}>{STATUS_LABELS[status]}</option>)}</select></label><span>{pending ? "正在保存……" : "状态修改会立即生效"}</span></div>
      </section>
    </div>
  </main>;
}

function statusClass(status: AdminInquiryStatus) {
  return `admin-inquiry-status admin-inquiry-status-${status}`;
}
