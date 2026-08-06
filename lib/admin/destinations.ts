import { and, asc, eq, ne, sql } from "drizzle-orm";
import { getDb } from "../../db";
import { plannerCities, plannerDestinations } from "../../db/schema";
import { ADMIN_TENANT_ID } from "./auth";
import { isAdminImagePathForUsage } from "./imageCatalog";

export const ADMIN_DESTINATION_STATUSES = ["draft", "published", "archived"] as const;
export const ADMIN_DESTINATION_CARD_SIZES = ["small", "large"] as const;
export const ADMIN_DESTINATION_PROVINCE_CODE = "guizhou" as const;
export const ADMIN_DESTINATION_FIELDS = [
  "slug",
  "cityCode",
  "nameZh",
  "nameEn",
  "descriptionZh",
  "descriptionEn",
  "imageUrl",
  "cardSize",
  "regionZh",
  "regionEn",
  "routeOrder",
  "overnightZh",
  "overnightEn",
  "recommendedVisitHours",
  "majorAttraction",
  "availableForPlanning",
  "showOnHomepage",
  "displayOrder",
  "status",
] as const;

export type AdminDestinationStatus = typeof ADMIN_DESTINATION_STATUSES[number];
export type AdminDestinationCardSize = typeof ADMIN_DESTINATION_CARD_SIZES[number];
export type AdminDestinationInput = {
  slug: string;
  cityCode: string;
  nameZh: string;
  nameEn: string;
  descriptionZh: string;
  descriptionEn: string;
  imageUrl: string;
  cardSize: AdminDestinationCardSize;
  regionZh: string;
  regionEn: string;
  routeOrder: number;
  overnightZh: string;
  overnightEn: string;
  recommendedVisitHours: number | null;
  majorAttraction: boolean;
  availableForPlanning: boolean;
  showOnHomepage: boolean;
  displayOrder: number;
  status: AdminDestinationStatus;
};

export type AdminCityOption = {
  code: string;
  nameZh: string;
  nameEn: string;
};

export type AdminDestinationValues = AdminDestinationInput & {
  id: string;
  cityNameZh: string;
  cityNameEn: string;
};

export type AdminDestinationFieldErrors = Record<string, string>;

export type AdminDestinationValidation = {
  values: AdminDestinationInput;
  fieldErrors: AdminDestinationFieldErrors;
  hasUnknownFields: boolean;
  invalidShape: boolean;
};

export class AdminDestinationConflictError extends Error {
  constructor(message = "Destination conflicts with an existing record") {
    super(message);
    this.name = "AdminDestinationConflictError";
  }
}

export class AdminDestinationNotFoundError extends Error {
  constructor(message = "Destination does not exist") {
    super(message);
    this.name = "AdminDestinationNotFoundError";
  }
}

export class AdminDestinationCityError extends Error {
  constructor(message = "Destination city is unavailable") {
    super(message);
    this.name = "AdminDestinationCityError";
  }
}

export class AdminDestinationConfigurationError extends Error {
  constructor(message = "Destination configuration is invalid") {
    super(message);
    this.name = "AdminDestinationConfigurationError";
  }
}

const SLUG_MIN_LENGTH = 3;
const SLUG_MAX_LENGTH = 80;
const NAME_ZH_MAX_LENGTH = 100;
const NAME_EN_MAX_LENGTH = 160;
const DESCRIPTION_ZH_MAX_LENGTH = 1000;
const DESCRIPTION_EN_MAX_LENGTH = 1500;
const REGION_MAX_LENGTH = 160;
const OVERNIGHT_ZH_MAX_LENGTH = 160;
const OVERNIGHT_EN_MAX_LENGTH = 240;
const ROUTE_ORDER_MIN = 0;
const ROUTE_ORDER_MAX = 1000;
const DISPLAY_ORDER_MIN = 0;
const DISPLAY_ORDER_MAX = 1000;
const VISIT_HOURS_MIN = 1;
const VISIT_HOURS_MAX = 48;
const HTML_MARKUP_PATTERN = /<\s*\/?\s*[a-z][^>]*>/i;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001F\u007F]/;
const SAFE_CODE_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const destinationSelection = {
  id: plannerDestinations.id,
  slug: plannerDestinations.slug,
  cityCode: plannerDestinations.cityCode,
  nameZh: plannerDestinations.nameZh,
  nameEn: plannerDestinations.nameEn,
  descriptionZh: plannerDestinations.descriptionZh,
  descriptionEn: plannerDestinations.descriptionEn,
  imageUrl: plannerDestinations.imageUrl,
  cardSize: plannerDestinations.cardSize,
  regionZh: plannerDestinations.regionZh,
  regionEn: plannerDestinations.regionEn,
  routeOrder: plannerDestinations.routeOrder,
  overnightZh: plannerDestinations.overnightZh,
  overnightEn: plannerDestinations.overnightEn,
  recommendedVisitHours: plannerDestinations.recommendedVisitHours,
  majorAttraction: plannerDestinations.majorAttraction,
  availableForPlanning: plannerDestinations.availableForPlanning,
  showOnHomepage: plannerDestinations.showOnHomepage,
  displayOrder: plannerDestinations.displayOrder,
  status: plannerDestinations.status,
  provinceCode: plannerDestinations.provinceCode,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function characterLength(value: string) {
  return Array.from(value).length;
}

function hasUnknownKeys(value: Record<string, unknown>) {
  return Object.keys(value).some((key) => !ADMIN_DESTINATION_FIELDS.includes(key as typeof ADMIN_DESTINATION_FIELDS[number]));
}

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

function validatePlainText(value: unknown, fieldErrors: AdminDestinationFieldErrors, key: string, label: string, maxLength: number, required = true) {
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

function validateSlug(value: unknown, fieldErrors: AdminDestinationFieldErrors) {
  if (typeof value !== "string") {
    fieldErrors.slug = "slug 必须是文本。";
    return "";
  }
  const normalizedValue = value.trim().toLowerCase();
  if (characterLength(normalizedValue) < SLUG_MIN_LENGTH || characterLength(normalizedValue) > SLUG_MAX_LENGTH || !SAFE_CODE_PATTERN.test(normalizedValue)) fieldErrors.slug = "slug 只能使用 3 到 80 个小写字母、数字和单个连字符。";
  return normalizedValue;
}

function validateCityCode(value: unknown, fieldErrors: AdminDestinationFieldErrors) {
  if (typeof value !== "string") {
    fieldErrors.cityCode = "所属城市格式不正确。";
    return "";
  }
  const normalizedValue = value.trim().toLowerCase();
  if (normalizedValue && !SAFE_CODE_PATTERN.test(normalizedValue)) fieldErrors.cityCode = "所属城市格式不正确。";
  return normalizedValue;
}

function validateImage(value: unknown, fieldErrors: AdminDestinationFieldErrors) {
  if (typeof value !== "string") {
    fieldErrors.imageUrl = "目的地图片格式不正确。";
    return "";
  }
  const normalizedValue = value.trim();
  if (normalizedValue && !isAdminImagePathForUsage(normalizedValue, "destination")) fieldErrors.imageUrl = "目的地图片只能从项目内置白名单中选择。";
  return normalizedValue;
}

function validateEnum<T extends readonly string[]>(value: unknown, values: T, fieldErrors: AdminDestinationFieldErrors, key: string, label: string): T[number] {
  if (typeof value !== "string" || !values.includes(value)) {
    fieldErrors[key] = `${label}不受支持。`;
    return values[0];
  }
  return value as T[number];
}

function validateInteger(value: unknown, fieldErrors: AdminDestinationFieldErrors, key: string, label: string, min: number, max: number) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    fieldErrors[key] = `${label}必须是 ${min} 到 ${max} 之间的整数。`;
    return 0;
  }
  return value;
}

function validateBoolean(value: unknown, fieldErrors: AdminDestinationFieldErrors, key: string, label: string) {
  if (typeof value !== "boolean") {
    fieldErrors[key] = `${label}必须是 true 或 false。`;
    return false;
  }
  return value;
}

function validateRecommendedVisitHours(value: unknown, fieldErrors: AdminDestinationFieldErrors) {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isInteger(value) || value < VISIT_HOURS_MIN || value > VISIT_HOURS_MAX) {
    fieldErrors.recommendedVisitHours = `建议游览时长必须为空或为 ${VISIT_HOURS_MIN} 到 ${VISIT_HOURS_MAX} 之间的整数。`;
    return null;
  }
  return value;
}

export function validateAdminDestinationPayload(body: unknown): AdminDestinationValidation {
  const fieldErrors: AdminDestinationFieldErrors = {};
  const values = emptyDestination();
  if (!isRecord(body)) return { values, fieldErrors: { destination: "目的地资料格式不正确。" }, hasUnknownFields: false, invalidShape: true };

  const hasUnknownFields = hasUnknownKeys(body);
  for (const key of Object.keys(body)) {
    if (!ADMIN_DESTINATION_FIELDS.includes(key as typeof ADMIN_DESTINATION_FIELDS[number])) fieldErrors[key] = "请求包含不支持的字段。";
  }

  values.slug = validateSlug(body.slug, fieldErrors);
  values.cityCode = validateCityCode(body.cityCode, fieldErrors);
  values.nameZh = validatePlainText(body.nameZh, fieldErrors, "nameZh", "中文名称", NAME_ZH_MAX_LENGTH);
  values.nameEn = validatePlainText(body.nameEn, fieldErrors, "nameEn", "英文名称", NAME_EN_MAX_LENGTH);
  values.descriptionZh = validatePlainText(body.descriptionZh, fieldErrors, "descriptionZh", "中文介绍", DESCRIPTION_ZH_MAX_LENGTH);
  values.descriptionEn = validatePlainText(body.descriptionEn, fieldErrors, "descriptionEn", "英文介绍", DESCRIPTION_EN_MAX_LENGTH);
  values.imageUrl = validateImage(body.imageUrl, fieldErrors);
  values.cardSize = validateEnum(body.cardSize, ADMIN_DESTINATION_CARD_SIZES, fieldErrors, "cardSize", "卡片大小") as AdminDestinationCardSize;
  values.regionZh = validatePlainText(body.regionZh, fieldErrors, "regionZh", "中文区域名称", REGION_MAX_LENGTH);
  values.regionEn = validatePlainText(body.regionEn, fieldErrors, "regionEn", "英文区域名称", REGION_MAX_LENGTH);
  values.routeOrder = validateInteger(body.routeOrder, fieldErrors, "routeOrder", "线路顺序", ROUTE_ORDER_MIN, ROUTE_ORDER_MAX);
  values.overnightZh = validatePlainText(body.overnightZh, fieldErrors, "overnightZh", "中文住宿建议", OVERNIGHT_ZH_MAX_LENGTH, false);
  values.overnightEn = validatePlainText(body.overnightEn, fieldErrors, "overnightEn", "英文住宿建议", OVERNIGHT_EN_MAX_LENGTH, false);
  if (Boolean(values.overnightZh) !== Boolean(values.overnightEn)) {
    fieldErrors.overnightZh ??= "填写住宿建议时必须同时填写中英文内容。";
    fieldErrors.overnightEn ??= "填写住宿建议时必须同时填写中英文内容。";
  }
  values.recommendedVisitHours = validateRecommendedVisitHours(body.recommendedVisitHours, fieldErrors);
  values.majorAttraction = validateBoolean(body.majorAttraction, fieldErrors, "majorAttraction", "主要景点") ;
  values.availableForPlanning = validateBoolean(body.availableForPlanning, fieldErrors, "availableForPlanning", "参与行程规划") ;
  values.showOnHomepage = validateBoolean(body.showOnHomepage, fieldErrors, "showOnHomepage", "首页展示") ;
  values.displayOrder = validateInteger(body.displayOrder, fieldErrors, "displayOrder", "首页显示顺序", DISPLAY_ORDER_MIN, DISPLAY_ORDER_MAX);
  values.status = validateEnum(body.status, ADMIN_DESTINATION_STATUSES, fieldErrors, "status", "目的地状态") as AdminDestinationStatus;
  if (values.showOnHomepage && !values.imageUrl) fieldErrors.imageUrl = "开启首页展示时必须选择合法的目的地图片。";

  return { values, fieldErrors, hasUnknownFields, invalidShape: false };
}

function assertAdminTenant(tenantId: string) {
  if (tenantId !== ADMIN_TENANT_ID) throw new Error("Invalid admin tenant boundary");
}

type AdminDestinationRow = {
  id: string;
  slug: string;
  cityCode: string | null;
  nameZh: string;
  nameEn: string;
  descriptionZh: string;
  descriptionEn: string;
  imageUrl: string;
  cardSize: string;
  regionZh: string;
  regionEn: string;
  routeOrder: number;
  overnightZh: string;
  overnightEn: string;
  recommendedVisitHours: number | null;
  majorAttraction: boolean;
  availableForPlanning: boolean;
  showOnHomepage: boolean;
  displayOrder: number;
  status: string;
  provinceCode: string;
};

function mapDestinationRow(row: AdminDestinationRow, cityByCode: Map<string, AdminCityOption>): AdminDestinationValues {
  if (row.provinceCode !== ADMIN_DESTINATION_PROVINCE_CODE || !ADMIN_DESTINATION_CARD_SIZES.includes(row.cardSize as AdminDestinationCardSize) || !ADMIN_DESTINATION_STATUSES.includes(row.status as AdminDestinationStatus)) throw new AdminDestinationConfigurationError();
  const city = row.cityCode ? cityByCode.get(row.cityCode) : undefined;
  return {
    id: row.id,
    slug: row.slug,
    cityCode: row.cityCode ?? "",
    cityNameZh: city?.nameZh ?? row.cityCode ?? "未设置",
    cityNameEn: city?.nameEn ?? row.cityCode ?? "Unassigned",
    nameZh: row.nameZh,
    nameEn: row.nameEn,
    descriptionZh: row.descriptionZh,
    descriptionEn: row.descriptionEn,
    imageUrl: row.imageUrl,
    cardSize: row.cardSize as AdminDestinationCardSize,
    regionZh: row.regionZh,
    regionEn: row.regionEn,
    routeOrder: row.routeOrder,
    overnightZh: row.overnightZh,
    overnightEn: row.overnightEn,
    recommendedVisitHours: row.recommendedVisitHours,
    majorAttraction: Boolean(row.majorAttraction),
    availableForPlanning: Boolean(row.availableForPlanning),
    showOnHomepage: Boolean(row.showOnHomepage),
    displayOrder: row.displayOrder,
    status: row.status as AdminDestinationStatus,
  };
}

async function getAdminCityRows(tenantId: string) {
  assertAdminTenant(tenantId);
  const db = await getDb();
  return db.select({ code: plannerCities.code, nameZh: plannerCities.nameZh, nameEn: plannerCities.nameEn })
    .from(plannerCities)
    .where(and(eq(plannerCities.tenantId, tenantId), eq(plannerCities.provinceCode, ADMIN_DESTINATION_PROVINCE_CODE), eq(plannerCities.status, "published")))
    .orderBy(asc(plannerCities.displayOrder), asc(plannerCities.code));
}

export async function getAdminDestinationBundle(tenantId: string) {
  assertAdminTenant(tenantId);
  const db = await getDb();
  const [destinationRows, cityRows] = await Promise.all([
    db.select(destinationSelection).from(plannerDestinations).where(eq(plannerDestinations.tenantId, tenantId)).orderBy(asc(plannerDestinations.displayOrder), asc(plannerDestinations.id)),
    getAdminCityRows(tenantId),
  ]);
  const cityOptions = cityRows.map((city) => ({ code: city.code, nameZh: city.nameZh, nameEn: city.nameEn }));
  const cityByCode = new Map(cityOptions.map((city) => [city.code, city]));
  return { destinations: destinationRows.map((row) => mapDestinationRow(row, cityByCode)), cityOptions };
}

async function assertCityBelongsToTenant(tenantId: string, cityCode: string) {
  if (!cityCode) return;
  const db = await getDb();
  const rows = await db.select({ code: plannerCities.code }).from(plannerCities).where(and(eq(plannerCities.tenantId, tenantId), eq(plannerCities.provinceCode, ADMIN_DESTINATION_PROVINCE_CODE), eq(plannerCities.code, cityCode), eq(plannerCities.status, "published"))).limit(1);
  if (!rows[0]) throw new AdminDestinationCityError();
}

function isUniqueViolation(error: unknown) {
  return /unique|constraint/i.test(error instanceof Error ? error.message : String(error));
}

function destinationWriteValues(values: AdminDestinationInput) {
  return {
    slug: values.slug,
    cityCode: values.cityCode || null,
    nameZh: values.nameZh,
    nameEn: values.nameEn,
    descriptionZh: values.descriptionZh,
    descriptionEn: values.descriptionEn,
    imageUrl: values.imageUrl,
    cardSize: values.cardSize,
    regionZh: values.regionZh,
    regionEn: values.regionEn,
    routeOrder: values.routeOrder,
    overnightZh: values.overnightZh,
    overnightEn: values.overnightEn,
    recommendedVisitHours: values.recommendedVisitHours,
    majorAttraction: values.majorAttraction,
    availableForPlanning: values.availableForPlanning,
    showOnHomepage: values.showOnHomepage,
    displayOrder: values.displayOrder,
    status: values.status,
  };
}

async function getDestinationForAdmin(tenantId: string, destinationId: string) {
  assertAdminTenant(tenantId);
  const db = await getDb();
  const rows = await db.select(destinationSelection).from(plannerDestinations).where(and(eq(plannerDestinations.id, destinationId), eq(plannerDestinations.tenantId, tenantId))).limit(1);
  return rows[0];
}

async function mapSavedDestination(tenantId: string, destinationId: string) {
  const bundle = await getAdminDestinationBundle(tenantId);
  const destination = bundle.destinations.find((item) => item.id === destinationId);
  if (!destination) throw new AdminDestinationConfigurationError("Saved destination could not be verified");
  return destination;
}

export async function createAdminDestination(tenantId: string, values: AdminDestinationInput) {
  assertAdminTenant(tenantId);
  await assertCityBelongsToTenant(tenantId, values.cityCode);
  const db = await getDb();
  const existing = await db.select({ id: plannerDestinations.id }).from(plannerDestinations).where(and(eq(plannerDestinations.tenantId, tenantId), eq(plannerDestinations.slug, values.slug))).limit(1);
  if (existing[0]) throw new AdminDestinationConflictError();
  const id = globalThis.crypto.randomUUID();
  try {
    await db.insert(plannerDestinations).values({ id, tenantId, provinceCode: ADMIN_DESTINATION_PROVINCE_CODE, ...destinationWriteValues(values) });
  } catch (error) {
    if (isUniqueViolation(error)) throw new AdminDestinationConflictError();
    throw error;
  }
  return mapSavedDestination(tenantId, id);
}

export async function updateAdminDestination(tenantId: string, destinationId: string, values: AdminDestinationInput) {
  assertAdminTenant(tenantId);
  const current = await getDestinationForAdmin(tenantId, destinationId);
  if (!current || current.provinceCode !== ADMIN_DESTINATION_PROVINCE_CODE) throw new AdminDestinationNotFoundError();
  await assertCityBelongsToTenant(tenantId, values.cityCode);
  const db = await getDb();
  const duplicate = await db.select({ id: plannerDestinations.id }).from(plannerDestinations).where(and(eq(plannerDestinations.tenantId, tenantId), eq(plannerDestinations.slug, values.slug), ne(plannerDestinations.id, destinationId))).limit(1);
  if (duplicate[0]) throw new AdminDestinationConflictError();
  try {
    await db.update(plannerDestinations).set({ ...destinationWriteValues(values), updatedAt: sql`CURRENT_TIMESTAMP` }).where(and(eq(plannerDestinations.id, destinationId), eq(plannerDestinations.tenantId, tenantId)));
  } catch (error) {
    if (isUniqueViolation(error)) throw new AdminDestinationConflictError();
    throw error;
  }
  return mapSavedDestination(tenantId, destinationId);
}
