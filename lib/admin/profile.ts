import { and, eq, sql } from "drizzle-orm";
import { getDb } from "../../db";
import { tenantSiteProfiles } from "../../db/schema";
import { ADMIN_TENANT_ID } from "./auth";

export const ADMIN_PROFILE_FIELDS = [
  "companyNameZh",
  "companyNameEn",
  "descriptionZh",
  "descriptionEn",
  "addressZh",
  "addressEn",
  "logoMark",
] as const;

export type AdminProfileField = typeof ADMIN_PROFILE_FIELDS[number];

export type AdminProfileValues = {
  [Field in AdminProfileField]: string;
};

export type AdminProfileFieldErrors = Partial<Record<AdminProfileField, string>>;

const ADMIN_PROFILE_MAX_LENGTHS: Record<AdminProfileField, number> = {
  companyNameZh: 100,
  companyNameEn: 160,
  descriptionZh: 1000,
  descriptionEn: 1500,
  addressZh: 300,
  addressEn: 500,
  logoMark: 4,
};

const ADMIN_PROFILE_REQUIRED_FIELDS = new Set<AdminProfileField>(["companyNameZh", "companyNameEn", "logoMark"]);
const HTML_MARKUP_PATTERN = /<\s*\/?\s*[a-z][^>]*>/i;

export type AdminProfileValidation = {
  values: AdminProfileValues;
  fieldErrors: AdminProfileFieldErrors;
  hasUnknownFields: boolean;
  invalidShape: boolean;
};

function emptyProfileValues(): AdminProfileValues {
  return {
    companyNameZh: "",
    companyNameEn: "",
    descriptionZh: "",
    descriptionEn: "",
    addressZh: "",
    addressEn: "",
    logoMark: "",
  };
}

function characterLength(value: string) {
  return Array.from(value).length;
}

export function validateAdminProfilePayload(body: unknown): AdminProfileValidation {
  const values = emptyProfileValues();
  const fieldErrors: AdminProfileFieldErrors = {};
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { values, fieldErrors, hasUnknownFields: false, invalidShape: true };
  }

  const payload = body as { [key: string]: unknown };
  const hasUnknownFields = Object.keys(payload).some((key) => !ADMIN_PROFILE_FIELDS.includes(key as AdminProfileField));

  for (const field of ADMIN_PROFILE_FIELDS) {
    const value = payload[field];
    if (typeof value !== "string") {
      fieldErrors[field] = "该字段必须是文本。";
      continue;
    }
    const normalizedValue = field === "companyNameZh" || field === "companyNameEn" || field === "logoMark" ? value.trim() : value;
    values[field] = normalizedValue;

    if (field !== "logoMark" && characterLength(normalizedValue) > ADMIN_PROFILE_MAX_LENGTHS[field]) {
      fieldErrors[field] = `内容不能超过 ${ADMIN_PROFILE_MAX_LENGTHS[field]} 个字符。`;
      continue;
    }
    if (ADMIN_PROFILE_REQUIRED_FIELDS.has(field) && normalizedValue.length === 0) {
      fieldErrors[field] = "该字段不能为空。";
      continue;
    }
    if (field === "logoMark" && /[\r\n]/.test(value)) {
      fieldErrors[field] = "Logo 标志不能包含换行。";
      continue;
    }
    if (field === "logoMark" && characterLength(normalizedValue) > ADMIN_PROFILE_MAX_LENGTHS.logoMark) {
      fieldErrors[field] = `Logo 标志不能超过 ${ADMIN_PROFILE_MAX_LENGTHS.logoMark} 个可见字符。`;
      continue;
    }
    if (HTML_MARKUP_PATTERN.test(value)) {
      fieldErrors[field] = "请使用纯文本，不要输入 HTML 标签。";
    }
  }

  return { values, fieldErrors, hasUnknownFields, invalidShape: false };
}

export type AdminProfileRow = AdminProfileValues;

const profileSelection = {
  companyNameZh: tenantSiteProfiles.companyNameZh,
  companyNameEn: tenantSiteProfiles.companyNameEn,
  descriptionZh: tenantSiteProfiles.descriptionZh,
  descriptionEn: tenantSiteProfiles.descriptionEn,
  addressZh: tenantSiteProfiles.addressZh,
  addressEn: tenantSiteProfiles.addressEn,
  logoMark: tenantSiteProfiles.logoMark,
};

export async function getAdminProfile(tenantId: string): Promise<AdminProfileRow | null> {
  if (tenantId !== ADMIN_TENANT_ID) throw new Error("Invalid admin tenant boundary");
  const db = await getDb();
  const [profile] = await db.select(profileSelection).from(tenantSiteProfiles).where(and(eq(tenantSiteProfiles.tenantId, ADMIN_TENANT_ID), eq(tenantSiteProfiles.status, "published"))).limit(1);
  return profile ?? null;
}

export async function updateAdminProfile(tenantId: string, values: AdminProfileValues): Promise<AdminProfileRow | null> {
  if (tenantId !== ADMIN_TENANT_ID) throw new Error("Invalid admin tenant boundary");
  const db = await getDb();
  const [profile] = await db.update(tenantSiteProfiles).set({ ...values, updatedAt: sql`CURRENT_TIMESTAMP` }).where(and(eq(tenantSiteProfiles.tenantId, ADMIN_TENANT_ID), eq(tenantSiteProfiles.status, "published"))).returning(profileSelection);
  return profile ?? null;
}
