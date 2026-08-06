import { and, asc, eq, ne, sql } from "drizzle-orm";
import { getDb } from "../../db";
import { tenantTours } from "../../db/schema";
import { ADMIN_TENANT_ID } from "./auth";
import { isAdminImagePathForUsage } from "./imageCatalog";

export const ADMIN_TOUR_STATUSES = ["draft", "published", "archived"] as const;
export const ADMIN_TOUR_FIELDS = [
  "slug",
  "titleZh",
  "titleEn",
  "descriptionZh",
  "descriptionEn",
  "durationZh",
  "durationEn",
  "tagZh",
  "tagEn",
  "priceTextZh",
  "priceTextEn",
  "imageUrl",
  "imageAltZh",
  "imageAltEn",
  "featured",
  "displayOrder",
  "status",
] as const;

export type AdminTourStatus = typeof ADMIN_TOUR_STATUSES[number];
export type AdminTourInput = {
  slug: string;
  titleZh: string;
  titleEn: string;
  descriptionZh: string;
  descriptionEn: string;
  durationZh: string;
  durationEn: string;
  tagZh: string;
  tagEn: string;
  priceTextZh: string;
  priceTextEn: string;
  imageUrl: string;
  imageAltZh: string;
  imageAltEn: string;
  featured: boolean;
  displayOrder: number;
  status: AdminTourStatus;
};

export type AdminTourValues = AdminTourInput & { id: string };
export type AdminTourFieldErrors = Record<string, string>;
export type AdminTourValidation = {
  values: AdminTourInput;
  fieldErrors: AdminTourFieldErrors;
  hasUnknownFields: boolean;
  invalidShape: boolean;
};

export class AdminTourConflictError extends Error {
  constructor(message = "Admin tour conflicts with an existing resource") {
    super(message);
    this.name = "AdminTourConflictError";
  }
}

export class AdminTourNotFoundError extends Error {
  constructor(message = "Admin tour was not found") {
    super(message);
    this.name = "AdminTourNotFoundError";
  }
}

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SLUG_MIN_LENGTH = 3;
const SLUG_MAX_LENGTH = 80;
const TITLE_ZH_MAX_LENGTH = 100;
const TITLE_EN_MAX_LENGTH = 160;
const DESCRIPTION_ZH_MAX_LENGTH = 1000;
const DESCRIPTION_EN_MAX_LENGTH = 1500;
const DURATION_ZH_MAX_LENGTH = 50;
const DURATION_EN_MAX_LENGTH = 80;
const TAG_ZH_MAX_LENGTH = 30;
const TAG_EN_MAX_LENGTH = 50;
const PRICE_TEXT_ZH_MAX_LENGTH = 60;
const PRICE_TEXT_EN_MAX_LENGTH = 100;
const IMAGE_ALT_ZH_MAX_LENGTH = 160;
const IMAGE_ALT_EN_MAX_LENGTH = 220;
const DISPLAY_ORDER_MIN = 0;
const DISPLAY_ORDER_MAX = 1000;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001F\u007F]/;
const HTML_MARKUP_PATTERN = /<\s*\/?\s*[a-z][^>]*>/i;

const tourSelection = {
  id: tenantTours.id,
  slug: tenantTours.slug,
  titleZh: tenantTours.titleZh,
  titleEn: tenantTours.titleEn,
  descriptionZh: tenantTours.descriptionZh,
  descriptionEn: tenantTours.descriptionEn,
  durationZh: tenantTours.durationZh,
  durationEn: tenantTours.durationEn,
  tagZh: tenantTours.tagZh,
  tagEn: tenantTours.tagEn,
  priceTextZh: tenantTours.priceTextZh,
  priceTextEn: tenantTours.priceTextEn,
  imageUrl: tenantTours.imageUrl,
  imageAltZh: tenantTours.imageAltZh,
  imageAltEn: tenantTours.imageAltEn,
  featured: tenantTours.featured,
  displayOrder: tenantTours.displayOrder,
  status: tenantTours.status,
};

type AdminTourRow = {
  id: string;
  slug: string;
  titleZh: string;
  titleEn: string;
  descriptionZh: string;
  descriptionEn: string;
  durationZh: string;
  durationEn: string;
  tagZh: string;
  tagEn: string;
  priceTextZh: string;
  priceTextEn: string;
  imageUrl: string;
  imageAltZh: string;
  imageAltEn: string;
  featured: boolean;
  displayOrder: number;
  status: string;
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

function emptyTourInput(): AdminTourInput {
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

function validateText(value: unknown, fieldErrors: AdminTourFieldErrors, key: string, label: string, maxLength: number, required: boolean) {
  if (typeof value !== "string") {
    fieldErrors[key] = `${label}必须是文本。`;
    return "";
  }
  const normalizedValue = value.trim();
  if (required && !normalizedValue) fieldErrors[key] = `${label}不能为空。`;
  else if (characterLength(normalizedValue) > maxLength) fieldErrors[key] = `${label}不能超过 ${maxLength} 个字符。`;
  else if (CONTROL_CHARACTER_PATTERN.test(normalizedValue) || HTML_MARKUP_PATTERN.test(normalizedValue)) fieldErrors[key] = `${label}不能包含 HTML、Script 或控制字符。`;
  return normalizedValue;
}

function validateSlug(value: unknown, fieldErrors: AdminTourFieldErrors) {
  if (typeof value !== "string") {
    fieldErrors.slug = "线路 slug 必须是文本。";
    return "";
  }
  const normalizedValue = value.trim();
  if (characterLength(normalizedValue) < SLUG_MIN_LENGTH || characterLength(normalizedValue) > SLUG_MAX_LENGTH || !SLUG_PATTERN.test(normalizedValue)) fieldErrors.slug = "线路 slug 只能使用小写字母、数字和单个连字符，长度为 3 到 80 个字符。";
  return normalizedValue;
}

function validateImagePath(value: unknown, fieldErrors: AdminTourFieldErrors) {
  if (value === undefined) return "";
  if (typeof value !== "string") {
    fieldErrors.imageUrl = "线路图片必须来自项目内置图片白名单。";
    return "";
  }
  const normalizedValue = value.trim();
  if (normalizedValue && !isAdminImagePathForUsage(normalizedValue, "tour")) fieldErrors.imageUrl = "请选择项目内置线路图片。";
  return normalizedValue;
}

function validateBoolean(value: unknown, fieldErrors: AdminTourFieldErrors) {
  if (typeof value !== "boolean") {
    fieldErrors.featured = "推荐状态必须是布尔值。";
    return false;
  }
  return value;
}

function validateDisplayOrder(value: unknown, fieldErrors: AdminTourFieldErrors) {
  if (!Number.isInteger(value) || (value as number) < DISPLAY_ORDER_MIN || (value as number) > DISPLAY_ORDER_MAX) {
    fieldErrors.displayOrder = `显示顺序必须是 ${DISPLAY_ORDER_MIN} 到 ${DISPLAY_ORDER_MAX} 之间的整数。`;
    return 0;
  }
  return value as number;
}

function validateStatus(value: unknown, fieldErrors: AdminTourFieldErrors): AdminTourStatus {
  if (typeof value !== "string" || !ADMIN_TOUR_STATUSES.includes(value as AdminTourStatus)) {
    fieldErrors.status = "线路状态不受支持。";
    return "draft";
  }
  return value as AdminTourStatus;
}

export function validateAdminTourPayload(body: unknown): AdminTourValidation {
  const values = emptyTourInput();
  const fieldErrors: AdminTourFieldErrors = {};
  if (!isRecord(body)) return { values, fieldErrors, hasUnknownFields: false, invalidShape: true };

  const payload = body;
  const hasUnknownFields = hasUnknownKeys(payload, ADMIN_TOUR_FIELDS);
  values.slug = validateSlug(payload.slug, fieldErrors);
  values.titleZh = validateText(payload.titleZh, fieldErrors, "titleZh", "中文标题", TITLE_ZH_MAX_LENGTH, true);
  values.titleEn = validateText(payload.titleEn, fieldErrors, "titleEn", "英文标题", TITLE_EN_MAX_LENGTH, true);
  values.descriptionZh = validateText(payload.descriptionZh, fieldErrors, "descriptionZh", "中文介绍", DESCRIPTION_ZH_MAX_LENGTH, true);
  values.descriptionEn = validateText(payload.descriptionEn, fieldErrors, "descriptionEn", "英文介绍", DESCRIPTION_EN_MAX_LENGTH, true);
  values.durationZh = validateText(payload.durationZh ?? "", fieldErrors, "durationZh", "中文行程时长", DURATION_ZH_MAX_LENGTH, false);
  values.durationEn = validateText(payload.durationEn ?? "", fieldErrors, "durationEn", "英文行程时长", DURATION_EN_MAX_LENGTH, false);
  values.tagZh = validateText(payload.tagZh ?? "", fieldErrors, "tagZh", "中文标签", TAG_ZH_MAX_LENGTH, false);
  values.tagEn = validateText(payload.tagEn ?? "", fieldErrors, "tagEn", "英文标签", TAG_EN_MAX_LENGTH, false);
  values.priceTextZh = validateText(payload.priceTextZh ?? "", fieldErrors, "priceTextZh", "中文价格文字", PRICE_TEXT_ZH_MAX_LENGTH, false);
  values.priceTextEn = validateText(payload.priceTextEn ?? "", fieldErrors, "priceTextEn", "英文价格文字", PRICE_TEXT_EN_MAX_LENGTH, false);
  values.imageUrl = validateImagePath(payload.imageUrl, fieldErrors);
  values.imageAltZh = validateText(payload.imageAltZh ?? "", fieldErrors, "imageAltZh", "中文图片替代文字", IMAGE_ALT_ZH_MAX_LENGTH, Boolean(values.imageUrl));
  values.imageAltEn = validateText(payload.imageAltEn ?? "", fieldErrors, "imageAltEn", "英文图片替代文字", IMAGE_ALT_EN_MAX_LENGTH, Boolean(values.imageUrl));
  values.featured = validateBoolean(payload.featured, fieldErrors);
  values.displayOrder = validateDisplayOrder(payload.displayOrder, fieldErrors);
  values.status = validateStatus(payload.status, fieldErrors);
  return { values, fieldErrors, hasUnknownFields, invalidShape: false };
}

function assertAdminTenant(tenantId: string) {
  if (tenantId !== ADMIN_TENANT_ID) throw new Error("Invalid admin tenant boundary");
}

function mapTourRow(row: AdminTourRow): AdminTourValues {
  if (!ADMIN_TOUR_STATUSES.includes(row.status as AdminTourStatus)) throw new Error("Admin tour status is invalid");
  return {
    id: row.id,
    slug: row.slug,
    titleZh: row.titleZh,
    titleEn: row.titleEn,
    descriptionZh: row.descriptionZh,
    descriptionEn: row.descriptionEn,
    durationZh: row.durationZh,
    durationEn: row.durationEn,
    tagZh: row.tagZh,
    tagEn: row.tagEn,
    priceTextZh: row.priceTextZh,
    priceTextEn: row.priceTextEn,
    imageUrl: row.imageUrl,
    imageAltZh: row.imageAltZh,
    imageAltEn: row.imageAltEn,
    featured: Boolean(row.featured),
    displayOrder: row.displayOrder,
    status: row.status as AdminTourStatus,
  };
}

function valuesMatch(row: AdminTourValues, values: AdminTourInput) {
  return Object.keys(values).every((key) => row[key as keyof AdminTourInput] === values[key as keyof AdminTourInput]);
}

function isUniqueViolation(error: unknown) {
  return /unique|constraint/i.test(error instanceof Error ? error.message : String(error));
}

export async function getAdminTours(tenantId: string): Promise<AdminTourValues[]> {
  assertAdminTenant(tenantId);
  const db = await getDb();
  const rows = await db.select(tourSelection).from(tenantTours).where(eq(tenantTours.tenantId, tenantId)).orderBy(asc(tenantTours.displayOrder), asc(tenantTours.id));
  return rows.map(mapTourRow);
}

export async function createAdminTour(tenantId: string, values: AdminTourInput): Promise<AdminTourValues> {
  assertAdminTenant(tenantId);
  const db = await getDb();
  const [existing] = await db.select({ id: tenantTours.id }).from(tenantTours).where(and(eq(tenantTours.tenantId, tenantId), eq(tenantTours.slug, values.slug))).limit(1);
  if (existing) throw new AdminTourConflictError();
  const id = crypto.randomUUID();
  try {
    await db.insert(tenantTours).values({ id, tenantId, ...values });
  } catch (error) {
    if (isUniqueViolation(error)) throw new AdminTourConflictError();
    throw error;
  }
  const [row] = await db.select(tourSelection).from(tenantTours).where(and(eq(tenantTours.id, id), eq(tenantTours.tenantId, tenantId))).limit(1);
  if (!row) throw new Error("Created admin tour could not be read back");
  return mapTourRow(row);
}

export async function updateAdminTour(tenantId: string, tourId: string, values: AdminTourInput): Promise<AdminTourValues> {
  assertAdminTenant(tenantId);
  const db = await getDb();
  const [current] = await db.select(tourSelection).from(tenantTours).where(and(eq(tenantTours.id, tourId), eq(tenantTours.tenantId, tenantId))).limit(1);
  if (!current) throw new AdminTourNotFoundError();
  const [conflictingTour] = await db.select({ id: tenantTours.id }).from(tenantTours).where(and(eq(tenantTours.tenantId, tenantId), eq(tenantTours.slug, values.slug), ne(tenantTours.id, tourId))).limit(1);
  if (conflictingTour) throw new AdminTourConflictError();

  try {
    await db.update(tenantTours).set({ ...values, updatedAt: sql`CURRENT_TIMESTAMP` }).where(and(eq(tenantTours.id, tourId), eq(tenantTours.tenantId, tenantId)));
  } catch (error) {
    if (isUniqueViolation(error)) throw new AdminTourConflictError();
    throw error;
  }

  const [saved] = await db.select(tourSelection).from(tenantTours).where(and(eq(tenantTours.id, tourId), eq(tenantTours.tenantId, tenantId))).limit(1);
  if (!saved || !valuesMatch(mapTourRow(saved), values)) throw new Error("Admin tour update verification failed");
  return mapTourRow(saved);
}
