import { and, asc, eq, sql } from "drizzle-orm";
import { getDb } from "../../db";
import { tenantHeroSlides, tenantSiteProfiles } from "../../db/schema";
import { HERO_IMAGE_POSITIONS } from "./imagePositions";
import { isAdminImagePathForUsage } from "./imageCatalog";
import { assertTenantScope } from "./tenantScope";

export const ADMIN_PROFILE_IMAGE_FIELDS = [
  "aboutImageUrl",
  "aboutImageAltZh",
  "aboutImageAltEn",
  "customizeImageUrl",
  "customizeImageAltZh",
  "customizeImageAltEn",
] as const;

export type AdminProfileImageField = typeof ADMIN_PROFILE_IMAGE_FIELDS[number];

export type AdminProfileImageValues = {
  [Field in AdminProfileImageField]: string;
};

export type AdminHeroImageValues = {
  imageUrl: string;
  altZh: string;
  altEn: string;
  desktopPosition: string;
  mobilePosition: string;
};

export type AdminImageFieldErrors = Record<string, string>;

export type AdminImageValidation<T> = {
  values: T;
  fieldErrors: AdminImageFieldErrors;
  hasUnknownFields: boolean;
  invalidShape: boolean;
};

export type AdminHeroImagesPayload = {
  slides: AdminHeroImageValues[];
};

export type AdminImageSettings = {
  heroSlides: AdminHeroImageValues[];
  profile: AdminProfileImageValues;
};

export class AdminImageConfigurationError extends Error {
  constructor(message = "Admin image configuration is invalid") {
    super(message);
    this.name = "AdminImageConfigurationError";
  }
}

const ALT_MAX_LENGTHS = {
  altZh: 160,
  altEn: 220,
} as const;

const HTML_MARKUP_PATTERN = /<\s*\/?\s*[a-z][^>]*>/i;
const HERO_IMAGE_FIELDS = ["imageUrl", "altZh", "altEn", "desktopPosition", "mobilePosition"] as const;

function characterLength(value: string) {
  return Array.from(value).length;
}

function emptyProfileImageValues(): AdminProfileImageValues {
  return {
    aboutImageUrl: "",
    aboutImageAltZh: "",
    aboutImageAltEn: "",
    customizeImageUrl: "",
    customizeImageAltZh: "",
    customizeImageAltEn: "",
  };
}

function emptyHeroImageValues(): AdminHeroImageValues {
  return {
    imageUrl: "",
    altZh: "",
    altEn: "",
    desktopPosition: "",
    mobilePosition: "",
  };
}

function validateAlt(value: unknown, field: "altZh" | "altEn", fieldErrors: AdminImageFieldErrors, key: string) {
  if (typeof value !== "string") {
    fieldErrors[key] = "替代文字必须是文本。";
    return "";
  }
  const normalizedValue = value.trim();
  if (!normalizedValue) {
    fieldErrors[key] = "替代文字不能为空。";
  } else if (characterLength(normalizedValue) > ALT_MAX_LENGTHS[field]) {
    fieldErrors[key] = `替代文字不能超过 ${ALT_MAX_LENGTHS[field]} 个字符。`;
  } else if (HTML_MARKUP_PATTERN.test(normalizedValue)) {
    fieldErrors[key] = "替代文字不能包含 HTML 标签。";
  }
  return normalizedValue;
}

function validateImagePath(value: unknown, usage: "hero" | "about" | "customize", fieldErrors: AdminImageFieldErrors, key: string) {
  if (!isAdminImagePathForUsage(value, usage)) {
    fieldErrors[key] = "请选择项目内置图片。";
    return "";
  }
  return value;
}

function validatePosition(value: unknown, fieldErrors: AdminImageFieldErrors, key: string) {
  if (typeof value !== "string" || !HERO_IMAGE_POSITIONS.includes(value as typeof HERO_IMAGE_POSITIONS[number])) {
    fieldErrors[key] = "请选择有效的图片位置。";
    return "";
  }
  return value;
}

function hasUnknownKeys(value: Record<string, unknown>, allowed: readonly string[]) {
  return Object.keys(value).some((key) => !allowed.includes(key));
}

export function validateAdminProfileImagesPayload(body: unknown): AdminImageValidation<AdminProfileImageValues> {
  const values = emptyProfileImageValues();
  const fieldErrors: AdminImageFieldErrors = {};
  if (!body || typeof body !== "object" || Array.isArray(body)) return { values, fieldErrors, hasUnknownFields: false, invalidShape: true };
  const payload = body as Record<string, unknown>;
  const hasUnknownFields = hasUnknownKeys(payload, ADMIN_PROFILE_IMAGE_FIELDS);

  values.aboutImageUrl = validateImagePath(payload.aboutImageUrl, "about", fieldErrors, "aboutImageUrl");
  values.aboutImageAltZh = validateAlt(payload.aboutImageAltZh, "altZh", fieldErrors, "aboutImageAltZh");
  values.aboutImageAltEn = validateAlt(payload.aboutImageAltEn, "altEn", fieldErrors, "aboutImageAltEn");
  values.customizeImageUrl = validateImagePath(payload.customizeImageUrl, "customize", fieldErrors, "customizeImageUrl");
  values.customizeImageAltZh = validateAlt(payload.customizeImageAltZh, "altZh", fieldErrors, "customizeImageAltZh");
  values.customizeImageAltEn = validateAlt(payload.customizeImageAltEn, "altEn", fieldErrors, "customizeImageAltEn");

  return { values, fieldErrors, hasUnknownFields, invalidShape: false };
}

export function validateAdminHeroImagesPayload(body: unknown): AdminImageValidation<AdminHeroImagesPayload> {
  const values: AdminHeroImagesPayload = { slides: [] };
  const fieldErrors: AdminImageFieldErrors = {};
  if (!body || typeof body !== "object" || Array.isArray(body)) return { values, fieldErrors, hasUnknownFields: false, invalidShape: true };
  const payload = body as Record<string, unknown>;
  const hasUnknownTopLevelFields = hasUnknownKeys(payload, ["slides"]);
  const slides = payload.slides;
  if (!Array.isArray(slides) || slides.length !== 2) return { values, fieldErrors: { slides: "Hero 必须提交现有的两张图片。" }, hasUnknownFields: hasUnknownTopLevelFields, invalidShape: false };

  let hasUnknownNestedFields = false;
  const normalizedSlides = slides.map((slide, index) => {
    if (!slide || typeof slide !== "object" || Array.isArray(slide)) {
      fieldErrors[`slides.${index}`] = "Hero 图片资料格式不正确。";
      return emptyHeroImageValues();
    }
    const record = slide as Record<string, unknown>;
    const hasUnknownFields = hasUnknownKeys(record, HERO_IMAGE_FIELDS);
    if (hasUnknownFields) {
      hasUnknownNestedFields = true;
      fieldErrors[`slides.${index}`] = "Hero 请求包含不支持的字段。";
    }
    return {
      imageUrl: validateImagePath(record.imageUrl, "hero", fieldErrors, `slides.${index}.imageUrl`),
      altZh: validateAlt(record.altZh, "altZh", fieldErrors, `slides.${index}.altZh`),
      altEn: validateAlt(record.altEn, "altEn", fieldErrors, `slides.${index}.altEn`),
      desktopPosition: validatePosition(record.desktopPosition, fieldErrors, `slides.${index}.desktopPosition`),
      mobilePosition: validatePosition(record.mobilePosition, fieldErrors, `slides.${index}.mobilePosition`),
    };
  });

  values.slides = normalizedSlides;
  return { values, fieldErrors, hasUnknownFields: hasUnknownTopLevelFields || hasUnknownNestedFields, invalidShape: false };
}

const profileImageSelection = {
  aboutImageUrl: tenantSiteProfiles.aboutImageUrl,
  aboutImageAltZh: tenantSiteProfiles.aboutImageAltZh,
  aboutImageAltEn: tenantSiteProfiles.aboutImageAltEn,
  customizeImageUrl: tenantSiteProfiles.customizeImageUrl,
  customizeImageAltZh: tenantSiteProfiles.customizeImageAltZh,
  customizeImageAltEn: tenantSiteProfiles.customizeImageAltEn,
};

const heroImageSelection = {
  imageUrl: tenantHeroSlides.imageUrl,
  altZh: tenantHeroSlides.altZh,
  altEn: tenantHeroSlides.altEn,
  desktopPosition: tenantHeroSlides.desktopPosition,
  mobilePosition: tenantHeroSlides.mobilePosition,
};

const heroRowSelection = {
  id: tenantHeroSlides.id,
  tenantId: tenantHeroSlides.tenantId,
  status: tenantHeroSlides.status,
  displayOrder: tenantHeroSlides.displayOrder,
  createdAt: tenantHeroSlides.createdAt,
  updatedAt: tenantHeroSlides.updatedAt,
  ...heroImageSelection,
};

type AdminHeroRow = {
  id: string;
  tenantId: string;
  status: string;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
  imageUrl: string;
  altZh: string;
  altEn: string;
  desktopPosition: string;
  mobilePosition: string;
};

function assertAdminTenant(tenantId: string) {
  assertTenantScope(tenantId);
}

async function getPublishedHeroRows(tenantId: string, dbOverride?: Awaited<ReturnType<typeof getDb>>) {
  assertAdminTenant(tenantId);
  const db = dbOverride ?? await getDb();
  return db.select(heroRowSelection).from(tenantHeroSlides).where(and(eq(tenantHeroSlides.tenantId, tenantId), eq(tenantHeroSlides.status, "published"))).orderBy(asc(tenantHeroSlides.displayOrder), asc(tenantHeroSlides.id));
}

export async function getAdminImageSettings(tenantId: string): Promise<AdminImageSettings> {
  assertAdminTenant(tenantId);
  const db = await getDb();
  const heroRows = await getPublishedHeroRows(tenantId, db);
  const profileRows = await db.select(profileImageSelection).from(tenantSiteProfiles).where(and(eq(tenantSiteProfiles.tenantId, tenantId), eq(tenantSiteProfiles.status, "published"))).limit(1);
  if (heroRows.length !== 2) throw new AdminImageConfigurationError("Published qianlin hero slide count is not two");
  if (!profileRows[0]) throw new AdminImageConfigurationError("Published qianlin site profile is missing");
  return {
    heroSlides: heroRows.map((row) => ({ imageUrl: row.imageUrl, altZh: row.altZh, altEn: row.altEn, desktopPosition: row.desktopPosition, mobilePosition: row.mobilePosition })),
    profile: profileRows[0],
  };
}

export async function updateAdminProfileImages(tenantId: string, values: AdminProfileImageValues): Promise<AdminProfileImageValues | null> {
  assertAdminTenant(tenantId);
  const db = await getDb();
  const [profile] = await db.update(tenantSiteProfiles).set({ ...values, updatedAt: sql`CURRENT_TIMESTAMP` }).where(and(eq(tenantSiteProfiles.tenantId, tenantId), eq(tenantSiteProfiles.status, "published"))).returning(profileImageSelection);
  return profile ?? null;
}

function heroValuesMatch(row: AdminHeroRow, values: AdminHeroImageValues) {
  return row.imageUrl === values.imageUrl && row.altZh === values.altZh && row.altEn === values.altEn && row.desktopPosition === values.desktopPosition && row.mobilePosition === values.mobilePosition;
}

export async function updateAdminHeroImages(tenantId: string, values: AdminHeroImageValues[]): Promise<AdminHeroImageValues[]> {
  assertAdminTenant(tenantId);
  const rows = await getPublishedHeroRows(tenantId);
  if (rows.length !== 2) throw new AdminImageConfigurationError("Published qianlin hero slide count is not two");

  const db = await getDb();
  // D1 batch executes both updates as one batch. The follow-up read verifies the complete result before success is returned.
  const statements = rows.map((row, index) => db.update(tenantHeroSlides).set({ ...values[index], updatedAt: sql`CURRENT_TIMESTAMP` }).where(and(eq(tenantHeroSlides.id, row.id), eq(tenantHeroSlides.tenantId, tenantId), eq(tenantHeroSlides.status, "published"), eq(tenantHeroSlides.displayOrder, row.displayOrder))));
  await db.batch(statements as [typeof statements[number], ...typeof statements[number][]]);

  const savedRows = await getPublishedHeroRows(tenantId);
  if (savedRows.length !== 2 || savedRows.some((row, index) => !heroValuesMatch(row, values[index]))) throw new Error("Hero image update verification failed");
  return savedRows.map((row) => ({ imageUrl: row.imageUrl, altZh: row.altZh, altEn: row.altEn, desktopPosition: row.desktopPosition, mobilePosition: row.mobilePosition }));
}
