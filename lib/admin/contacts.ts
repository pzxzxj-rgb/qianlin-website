import { and, asc, eq, sql } from "drizzle-orm";
import { getDb } from "../../db";
import { tenantContactChannels } from "../../db/schema";
import { ADMIN_TENANT_ID } from "./auth";

export const ADMIN_CONTACT_TYPES = ["phone", "wechat", "email"] as const;
export const ADMIN_CONTACT_STATUSES = ["draft", "published", "archived"] as const;
export const ADMIN_CONTACT_FIELDS = ["id", "type", "labelZh", "labelEn", "value", "href", "displayOrder", "status"] as const;

export type AdminContactType = typeof ADMIN_CONTACT_TYPES[number];
export type AdminContactStatus = typeof ADMIN_CONTACT_STATUSES[number];
export type AdminContactChannelValues = {
  id: string;
  type: AdminContactType;
  labelZh: string;
  labelEn: string;
  value: string;
  href: string;
  displayOrder: number;
  status: AdminContactStatus;
};

export type AdminContactFieldErrors = Record<string, string>;

export type AdminContactValidation = {
  values: AdminContactChannelValues[];
  fieldErrors: AdminContactFieldErrors;
  hasUnknownFields: boolean;
  invalidShape: boolean;
};

export class AdminContactConfigurationError extends Error {
  constructor(message = "Admin contact configuration changed") {
    super(message);
    this.name = "AdminContactConfigurationError";
  }
}

const CONTACT_LABEL_MAX_LENGTH = 100;
const CONTACT_VALUE_MAX_LENGTHS: Record<AdminContactType, number> = {
  phone: 32,
  wechat: 64,
  email: 254,
};
const CONTACT_HREF_MAX_LENGTH = 2048;
const DISPLAY_ORDER_MIN = 0;
const DISPLAY_ORDER_MAX = 1000;
const HTML_MARKUP_PATTERN = /<\s*\/?\s*[a-z][^>]*>/i;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001F\u007F]/;
const ENCODED_CONTROL_CHARACTER_PATTERN = /%(?:0[0-9a-f]|1[0-9a-f]|7f)/i;
const MAINLAND_PHONE_PATTERN = /^1[3-9]\d{9}$/;
const EMAIL_PATTERN = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const PHONE_SEPARATOR_PATTERN = /[\s\-\u2010-\u2015\u2212\uFF0D]/g;
const HREF_PATH_TRAVERSAL_PATTERN = /(?:\.\.|%2e%2e)/i;
const DISALLOWED_HREF_PROTOCOLS = new Set(["javascript:", "data:", "blob:"]);

const contactSelection = {
  id: tenantContactChannels.id,
  type: tenantContactChannels.type,
  labelZh: tenantContactChannels.labelZh,
  labelEn: tenantContactChannels.labelEn,
  value: tenantContactChannels.value,
  href: tenantContactChannels.href,
  displayOrder: tenantContactChannels.displayOrder,
  status: tenantContactChannels.status,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasUnknownKeys(value: Record<string, unknown>, allowed: readonly string[]) {
  return Object.keys(value).some((key) => !allowed.includes(key));
}

function characterLength(value: string) {
  return Array.from(value).length;
}

function containsEncodedControlCharacter(value: string) {
  let candidate = value;
  for (let index = 0; index < 3; index += 1) {
    if (CONTROL_CHARACTER_PATTERN.test(candidate) || ENCODED_CONTROL_CHARACTER_PATTERN.test(candidate)) return true;
    try {
      const decoded = decodeURIComponent(candidate);
      if (decoded === candidate) return false;
      candidate = decoded;
    } catch {
      return false;
    }
  }
  return CONTROL_CHARACTER_PATTERN.test(candidate) || ENCODED_CONTROL_CHARACTER_PATTERN.test(candidate);
}

function emptyContactValues(): AdminContactChannelValues {
  return { id: "", type: "phone", labelZh: "", labelEn: "", value: "", href: "", displayOrder: 0, status: "published" };
}

function validatePlainText(value: unknown, fieldErrors: AdminContactFieldErrors, key: string, label: string) {
  if (typeof value !== "string") {
    fieldErrors[key] = `${label}必须是文本。`;
    return "";
  }
  const normalizedValue = value.trim();
  if (!normalizedValue) fieldErrors[key] = `${label}不能为空。`;
  else if (characterLength(normalizedValue) > CONTACT_LABEL_MAX_LENGTH) fieldErrors[key] = `${label}不能超过 ${CONTACT_LABEL_MAX_LENGTH} 个字符。`;
  else if (CONTROL_CHARACTER_PATTERN.test(normalizedValue) || HTML_MARKUP_PATTERN.test(normalizedValue)) fieldErrors[key] = `${label}不能包含 HTML、Script 或控制字符。`;
  return normalizedValue;
}

function validateType(value: unknown, fieldErrors: AdminContactFieldErrors, key: string): AdminContactType {
  if (typeof value !== "string" || !ADMIN_CONTACT_TYPES.includes(value as AdminContactType)) {
    fieldErrors[key] = "联系方式类型不受支持。";
    return "phone";
  }
  return value as AdminContactType;
}

function validateValue(value: unknown, type: AdminContactType, fieldErrors: AdminContactFieldErrors, key: string) {
  if (typeof value !== "string") {
    fieldErrors[key] = "联系方式内容必须是文本。";
    return "";
  }
  const normalizedValue = value.trim();
  if (!normalizedValue) {
    fieldErrors[key] = "联系方式内容不能为空。";
    return "";
  }
  if (characterLength(normalizedValue) > CONTACT_VALUE_MAX_LENGTHS[type]) {
    fieldErrors[key] = `联系方式内容不能超过 ${CONTACT_VALUE_MAX_LENGTHS[type]} 个字符。`;
    return normalizedValue;
  }
  if (CONTROL_CHARACTER_PATTERN.test(normalizedValue) || HTML_MARKUP_PATTERN.test(normalizedValue)) {
    fieldErrors[key] = "联系方式内容不能包含 HTML、Script 或控制字符。";
    return normalizedValue;
  }

  if (type === "phone") {
    const phone = normalizedValue.replace(PHONE_SEPARATOR_PATTERN, "");
    if (!MAINLAND_PHONE_PATTERN.test(phone)) fieldErrors[key] = "电话必须是中国大陆 11 位手机号码。";
    return phone;
  }
  if (type === "email") {
    const email = normalizedValue.toLowerCase();
    if (!EMAIL_PATTERN.test(email) || email.length > CONTACT_VALUE_MAX_LENGTHS.email) fieldErrors[key] = "请输入有效邮箱地址。";
    return email;
  }
  return normalizedValue;
}

function validateHref(value: unknown, type: AdminContactType, contactValue: string, fieldErrors: AdminContactFieldErrors, key: string) {
  if (typeof value !== "string") {
    fieldErrors[key] = "跳转链接必须是文本。";
    return "";
  }
  const normalizedValue = value.trim();
  if (!normalizedValue) {
    if (type === "phone") return `tel:+86${contactValue}`;
    if (type === "email") return `mailto:${contactValue}`;
    return "";
  }
  if (characterLength(normalizedValue) > CONTACT_HREF_MAX_LENGTH || containsEncodedControlCharacter(normalizedValue) || /[<>"'\\]/.test(normalizedValue) || HREF_PATH_TRAVERSAL_PATTERN.test(normalizedValue)) {
    fieldErrors[key] = "跳转链接包含不安全内容。";
    return normalizedValue;
  }

  try {
    const parsed = new URL(normalizedValue);
    const protocol = parsed.protocol.toLowerCase();
    if (DISALLOWED_HREF_PROTOCOLS.has(protocol)) {
      fieldErrors[key] = "跳转链接不允许使用 javascript:、data: 或 blob: 协议。";
      return normalizedValue;
    }
    if (protocol === "tel:") {
      const phone = normalizedValue.slice(4).replace(PHONE_SEPARATOR_PATTERN, "");
      const normalizedPhone = phone.startsWith("+86") ? phone.slice(3) : phone;
      if (type !== "phone" || !MAINLAND_PHONE_PATTERN.test(normalizedPhone) || normalizedPhone !== contactValue) fieldErrors[key] = "电话跳转链接必须与电话内容一致。";
      return `tel:+86${normalizedPhone}`;
    }
    if (protocol === "mailto:") {
      const email = normalizedValue.slice(7).toLowerCase();
      if (type !== "email" || !EMAIL_PATTERN.test(email) || email.includes("?") || email.includes("#") || email !== contactValue) fieldErrors[key] = "邮箱跳转链接必须与邮箱内容一致。";
      return `mailto:${email}`;
    }
    if (protocol !== "https:" || type !== "wechat" || !parsed.hostname || parsed.username || parsed.password || parsed.search.includes("javascript:")) {
      fieldErrors[key] = "跳转链接只允许 tel:、mailto: 或合法的 https: 地址。";
      return normalizedValue;
    }
    return normalizedValue;
  } catch {
    fieldErrors[key] = "跳转链接格式不正确。";
    return normalizedValue;
  }
}

function validateDisplayOrder(value: unknown, fieldErrors: AdminContactFieldErrors, key: string) {
  if (!Number.isInteger(value) || (value as number) < DISPLAY_ORDER_MIN || (value as number) > DISPLAY_ORDER_MAX) {
    fieldErrors[key] = `显示顺序必须是 ${DISPLAY_ORDER_MIN} 到 ${DISPLAY_ORDER_MAX} 之间的整数。`;
    return 0;
  }
  return value as number;
}

function validateStatus(value: unknown, fieldErrors: AdminContactFieldErrors, key: string): AdminContactStatus {
  if (typeof value !== "string" || !ADMIN_CONTACT_STATUSES.includes(value as AdminContactStatus)) {
    fieldErrors[key] = "联系方式状态不受支持。";
    return "published";
  }
  return value as AdminContactStatus;
}

export function validateAdminContactsPayload(body: unknown): AdminContactValidation {
  const values: AdminContactChannelValues[] = [];
  const fieldErrors: AdminContactFieldErrors = {};
  if (!isRecord(body)) return { values, fieldErrors, hasUnknownFields: false, invalidShape: true };
  const payload = body;
  const hasUnknownTopLevelFields = hasUnknownKeys(payload, ["channels"]);
  const channels = payload.channels;
  if (!Array.isArray(channels) || channels.length < 1 || channels.length > 12) {
    return { values, fieldErrors: { channels: "联系方式记录格式不正确。" }, hasUnknownFields: hasUnknownTopLevelFields, invalidShape: true };
  }

  let hasUnknownNestedFields = false;
  const seenIds = new Set<string>();
  channels.forEach((channel, index) => {
    const prefix = `channels.${index}`;
    if (!isRecord(channel)) {
      fieldErrors[prefix] = "联系方式记录格式不正确。";
      values.push(emptyContactValues());
      return;
    }
    if (hasUnknownKeys(channel, ADMIN_CONTACT_FIELDS)) {
      hasUnknownNestedFields = true;
      fieldErrors[prefix] = "联系方式请求包含不支持的字段。";
    }
    const idValue = channel.id;
    const id = typeof idValue === "string" ? idValue.trim() : "";
    if (!id || characterLength(id) > 160 || CONTROL_CHARACTER_PATTERN.test(id)) fieldErrors[`${prefix}.id`] = "联系方式记录标识不正确。";
    if (seenIds.has(id)) fieldErrors[`${prefix}.id`] = "联系方式记录不能重复提交。";
    seenIds.add(id);
    const type = validateType(channel.type, fieldErrors, `${prefix}.type`);
    const labelZh = validatePlainText(channel.labelZh, fieldErrors, `${prefix}.labelZh`, "中文显示名称");
    const labelEn = validatePlainText(channel.labelEn, fieldErrors, `${prefix}.labelEn`, "英文显示名称");
    const normalizedValue = validateValue(channel.value, type, fieldErrors, `${prefix}.value`);
    const href = validateHref(channel.href, type, normalizedValue, fieldErrors, `${prefix}.href`);
    const displayOrder = validateDisplayOrder(channel.displayOrder, fieldErrors, `${prefix}.displayOrder`);
    const status = validateStatus(channel.status, fieldErrors, `${prefix}.status`);
    values.push({ id, type, labelZh, labelEn, value: normalizedValue, href, displayOrder, status });
  });

  return { values, fieldErrors, hasUnknownFields: hasUnknownTopLevelFields || hasUnknownNestedFields, invalidShape: false };
}

function assertAdminTenant(tenantId: string) {
  if (tenantId !== ADMIN_TENANT_ID) throw new Error("Invalid admin tenant boundary");
}

type AdminContactRow = {
  id: string;
  type: string;
  labelZh: string;
  labelEn: string;
  value: string;
  href: string | null;
  displayOrder: number;
  status: string;
};

function mapContactRow(row: AdminContactRow): AdminContactChannelValues {
  if (!ADMIN_CONTACT_TYPES.includes(row.type as AdminContactType) || !ADMIN_CONTACT_STATUSES.includes(row.status as AdminContactStatus)) throw new AdminContactConfigurationError();
  return { id: row.id, type: row.type as AdminContactType, labelZh: row.labelZh, labelEn: row.labelEn, value: row.value, href: row.href ?? "", displayOrder: row.displayOrder, status: row.status as AdminContactStatus };
}

async function getContactRows(tenantId: string) {
  assertAdminTenant(tenantId);
  const db = await getDb();
  return db.select(contactSelection).from(tenantContactChannels).where(eq(tenantContactChannels.tenantId, tenantId)).orderBy(asc(tenantContactChannels.displayOrder), asc(tenantContactChannels.id));
}

export async function getAdminContacts(tenantId: string): Promise<AdminContactChannelValues[]> {
  return (await getContactRows(tenantId)).map(mapContactRow);
}

function contactValuesMatch(row: AdminContactChannelValues, values: AdminContactChannelValues) {
  return row.id === values.id && row.type === values.type && row.labelZh === values.labelZh && row.labelEn === values.labelEn && row.value === values.value && row.href === values.href && row.displayOrder === values.displayOrder && row.status === values.status;
}

export async function updateAdminContacts(tenantId: string, values: AdminContactChannelValues[]): Promise<AdminContactChannelValues[]> {
  assertAdminTenant(tenantId);
  const currentRows = await getAdminContacts(tenantId);
  const currentById = new Map(currentRows.map((row) => [row.id, row]));
  if (currentRows.length === 0 || currentRows.length !== values.length || new Set(values.map((value) => value.id)).size !== currentRows.length || values.some((value) => {
    const current = currentById.get(value.id);
    return !current || current.type !== value.type;
  })) throw new AdminContactConfigurationError();
  if (new Set(values.map((value) => value.type)).size !== values.length) throw new AdminContactConfigurationError();

  const db = await getDb();
  const statements = values.map((value) => db.update(tenantContactChannels).set({ type: value.type, labelZh: value.labelZh, labelEn: value.labelEn, value: value.value, href: value.href || null, displayOrder: value.displayOrder, status: value.status, updatedAt: sql`CURRENT_TIMESTAMP` }).where(and(eq(tenantContactChannels.id, value.id), eq(tenantContactChannels.tenantId, tenantId))));
  await db.batch(statements as [typeof statements[number], ...typeof statements[number][]]);

  const savedRows = await getAdminContacts(tenantId);
  if (savedRows.length !== values.length || savedRows.some((row) => {
    const expected = values.find((value) => value.id === row.id);
    return !expected || !contactValuesMatch(row, expected);
  })) throw new Error("Admin contact update verification failed");
  return savedRows;
}
