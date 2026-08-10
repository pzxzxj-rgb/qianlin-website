import { and, count, desc, eq, gte } from "drizzle-orm";
import { getDb } from "../../db";
import { inquiries } from "../../db/schema";
import { assertTenantScope } from "./tenantScope";

export const ADMIN_INQUIRY_STATUSES = ["new", "contacted", "following_up", "completed", "closed"] as const;
export type AdminInquiryStatus = typeof ADMIN_INQUIRY_STATUSES[number];

export const ADMIN_INQUIRY_PAGE_SIZE = 20;
export const ADMIN_INQUIRY_MAX_PAGE_SIZE = 50;

export type AdminInquiryListItem = {
  id: number;
  createdAt: string;
  name: string;
  contactSummary: string;
  travelers: string;
  travelDate: string;
  status: AdminInquiryStatus;
};

export type AdminInquiryListResponse = {
  items: AdminInquiryListItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  status: AdminInquiryStatus | null;
};

export type AdminInquiryDetail = {
  id: number;
  name: string;
  phone: string;
  wechat: string;
  email: string;
  travelDate: string;
  travelers: string;
  message: string;
  createdAt: string;
  status: AdminInquiryStatus;
};

export type AdminInquiryStats = {
  newInquiries: number;
  followingUpInquiries: number;
  todayNewInquiries: number;
};

function assertAdminTenant(tenantId: string) {
  assertTenantScope(tenantId);
}

function maskPhone(value: string) {
  if (!value) return "未填写";
  if (value.length < 7) return "已填写";
  return `${value.slice(0, 3)}****${value.slice(-4)}`;
}

function maskText(value: string) {
  const characters = Array.from(value.trim());
  if (characters.length === 0) return "";
  if (characters.length === 1) return `${characters[0]}*`;
  return `${characters[0]}***${characters[characters.length - 1]}`;
}

function maskEmail(value: string) {
  if (!value) return "";
  const separator = value.indexOf("@");
  if (separator <= 0) return maskText(value);
  const localPart = value.slice(0, separator);
  const domain = value.slice(separator + 1);
  return `${localPart.slice(0, 1)}***@${domain}`;
}

function buildContactSummary(row: { phone: string; wechat: string; email: string }) {
  const parts = [
    row.phone ? `手机 ${maskPhone(row.phone)}` : "",
    row.wechat ? `微信 ${maskText(row.wechat)}` : "",
    row.email ? `邮箱 ${maskEmail(row.email)}` : "",
  ].filter(Boolean);
  return parts.join(" · ") || "未填写";
}

function normalizePage(value: number) {
  return Number.isSafeInteger(value) && value > 0 ? value : 1;
}

function normalizePageSize(value: number) {
  if (!Number.isSafeInteger(value) || value <= 0) return ADMIN_INQUIRY_PAGE_SIZE;
  return Math.min(value, ADMIN_INQUIRY_MAX_PAGE_SIZE);
}

function inquiryFilters(tenantId: string, status?: AdminInquiryStatus) {
  return status
    ? and(eq(inquiries.tenantId, tenantId), eq(inquiries.status, status))
    : eq(inquiries.tenantId, tenantId);
}

export async function getAdminInquiries(tenantId: string, input: { status?: AdminInquiryStatus; page?: number; pageSize?: number } = {}): Promise<AdminInquiryListResponse> {
  assertAdminTenant(tenantId);
  const page = normalizePage(input.page ?? 1);
  const pageSize = normalizePageSize(input.pageSize ?? ADMIN_INQUIRY_PAGE_SIZE);
  const where = inquiryFilters(tenantId, input.status);
  const db = await getDb();
  const [rows, totalRows] = await Promise.all([
    db.select({ id: inquiries.id, createdAt: inquiries.createdAt, name: inquiries.name, phone: inquiries.phone, wechat: inquiries.wechat, email: inquiries.email, travelers: inquiries.travelers, travelDate: inquiries.travelDate, status: inquiries.status }).from(inquiries).where(where).orderBy(desc(inquiries.createdAt), desc(inquiries.id)).limit(pageSize).offset((page - 1) * pageSize),
    db.select({ value: count() }).from(inquiries).where(where),
  ]);
  const total = Number(totalRows[0]?.value ?? 0);
  return {
    items: rows.map((row) => ({ id: row.id, createdAt: row.createdAt, name: row.name, contactSummary: buildContactSummary(row), travelers: row.travelers, travelDate: row.travelDate, status: row.status as AdminInquiryStatus })),
    pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    status: input.status ?? null,
  };
}

export async function getAdminInquiryDetail(tenantId: string, inquiryId: number): Promise<AdminInquiryDetail | null> {
  assertAdminTenant(tenantId);
  const db = await getDb();
  const rows = await db.select({ id: inquiries.id, name: inquiries.name, phone: inquiries.phone, wechat: inquiries.wechat, email: inquiries.email, travelDate: inquiries.travelDate, travelers: inquiries.travelers, message: inquiries.message, createdAt: inquiries.createdAt, status: inquiries.status }).from(inquiries).where(and(eq(inquiries.tenantId, tenantId), eq(inquiries.id, inquiryId))).limit(1);
  const row = rows[0];
  return row ? { ...row, status: row.status as AdminInquiryStatus } : null;
}

export async function updateAdminInquiryStatus(tenantId: string, inquiryId: number, status: AdminInquiryStatus) {
  assertAdminTenant(tenantId);
  const db = await getDb();
  const rows = await db.update(inquiries).set({ status }).where(and(eq(inquiries.tenantId, tenantId), eq(inquiries.id, inquiryId))).returning({ id: inquiries.id, status: inquiries.status, createdAt: inquiries.createdAt });
  const row = rows[0];
  return row ? { ...row, status: row.status as AdminInquiryStatus } : null;
}

export function getChinaDayStartUtc(now = new Date()) {
  const chinaDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).format(now);
  return new Date(`${chinaDate}T00:00:00+08:00`).toISOString().replace("T", " ").slice(0, 19);
}

export async function getAdminInquiryStats(tenantId: string): Promise<AdminInquiryStats> {
  assertAdminTenant(tenantId);
  const db = await getDb();
  const todayStartUtc = getChinaDayStartUtc();
  const [newRows, followingUpRows, todayRows] = await Promise.all([
    db.select({ value: count() }).from(inquiries).where(and(eq(inquiries.tenantId, tenantId), eq(inquiries.status, "new"))),
    db.select({ value: count() }).from(inquiries).where(and(eq(inquiries.tenantId, tenantId), eq(inquiries.status, "following_up"))),
    db.select({ value: count() }).from(inquiries).where(and(eq(inquiries.tenantId, tenantId), gte(inquiries.createdAt, todayStartUtc))),
  ]);
  return { newInquiries: Number(newRows[0]?.value ?? 0), followingUpInquiries: Number(followingUpRows[0]?.value ?? 0), todayNewInquiries: Number(todayRows[0]?.value ?? 0) };
}

export { buildContactSummary, maskEmail, maskPhone, maskText };
