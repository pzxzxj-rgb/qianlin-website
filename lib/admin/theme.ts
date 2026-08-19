import { and, asc, eq, sql } from "drizzle-orm";
import { getDb } from "../../db";
import { tenantThemes } from "../../db/schema";
import { assertTenantScope } from "./tenantScope";
import {
  THEME_BUTTON_STYLES,
  THEME_CARD_STYLES,
  THEME_DRAFT_FIELDS,
  THEME_FONT_PRESETS,
  THEME_PRESET_OPTIONS,
  THEME_SECTION_STYLES,
  THEME_TEMPLATE_KEYS,
  type ThemeDraftValues,
  isThemeHexColor,
  themeDraftFromRow,
} from "../theme/themeConfig";

export type AdminThemeValidation = {
  values: ThemeDraftValues;
  fieldErrors: Record<string, string>;
  hasUnknownFields: boolean;
  invalidShape: boolean;
};

export type AdminThemeRecord = {
  id: string;
  status: "draft" | "published";
  values: ThemeDraftValues;
  version: number;
  publishedBy: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminThemeState = {
  draft: AdminThemeRecord;
  published: AdminThemeRecord;
  availablePresets: typeof THEME_PRESET_OPTIONS;
};

export class AdminThemeConfigurationError extends Error {
  constructor(message = "Theme configuration is invalid") {
    super(message);
    this.name = "AdminThemeConfigurationError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isOneOf<T extends readonly string[]>(value: unknown, values: T): value is T[number] {
  return typeof value === "string" && values.includes(value);
}

function emptyThemeValues(): ThemeDraftValues {
  return {
    templateKey: "modern",
    primaryColor: "#173F36",
    secondaryColor: "#DCE6DC",
    accentColor: "#C7A878",
    backgroundColor: "#FBFAF7",
    fontPreset: "modern",
    buttonStyle: "rounded",
    cardStyle: "elevated",
    sectionStyle: "clean",
  };
}

export function validateAdminThemeDraftPayload(body: unknown): AdminThemeValidation {
  const values = emptyThemeValues();
  const fieldErrors: Record<string, string> = {};
  if (!isRecord(body)) return { values, fieldErrors, hasUnknownFields: false, invalidShape: true };

  const hasUnknownFields = Object.keys(body).some((key) => !THEME_DRAFT_FIELDS.includes(key as typeof THEME_DRAFT_FIELDS[number]));
  const stringFields = ["primaryColor", "secondaryColor", "accentColor", "backgroundColor"] as const;
  for (const field of stringFields) {
    const value = body[field];
    if (typeof value !== "string" || !isThemeHexColor(value)) {
      fieldErrors[field] = "Color must be a six-digit HEX value such as #123456.";
    } else {
      values[field] = value.toUpperCase();
    }
  }

  const enumFields = [
    ["templateKey", THEME_TEMPLATE_KEYS],
    ["fontPreset", THEME_FONT_PRESETS],
    ["buttonStyle", THEME_BUTTON_STYLES],
    ["cardStyle", THEME_CARD_STYLES],
    ["sectionStyle", THEME_SECTION_STYLES],
  ] as const;
  for (const [field, options] of enumFields) {
    const value = body[field];
    if (!isOneOf(value, options)) {
      fieldErrors[field] = "Theme value is not supported.";
    } else {
      (values as unknown as Record<string, string>)[field] = value;
    }
  }

  return { values, fieldErrors, hasUnknownFields, invalidShape: false };
}

function mapThemeRow(row: typeof tenantThemes.$inferSelect): AdminThemeRecord {
  if ((row.status !== "draft" && row.status !== "published") || !Number.isInteger(row.version) || row.version < 1) throw new AdminThemeConfigurationError();
  const values = themeDraftFromRow(row);
  if (!values) throw new AdminThemeConfigurationError();
  return {
    id: row.id,
    status: row.status,
    values,
    version: row.version,
    publishedBy: row.publishedBy,
    publishedAt: row.publishedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function getThemeRows(tenantId: string) {
  assertTenantScope(tenantId);
  const db = await getDb();
  return db.select().from(tenantThemes).where(eq(tenantThemes.tenantId, tenantId)).orderBy(asc(tenantThemes.status));
}

function requireThemeRows(rows: typeof tenantThemes.$inferSelect[]) {
  const draft = rows.find((row) => row.status === "draft");
  const published = rows.find((row) => row.status === "published");
  if (!draft || !published) throw new AdminThemeConfigurationError("Draft or published theme is missing");
  return { draft: mapThemeRow(draft), published: mapThemeRow(published) };
}

export async function getAdminThemeState(tenantId: string): Promise<AdminThemeState> {
  const rows = await getThemeRows(tenantId);
  const { draft, published } = requireThemeRows(rows);
  return { draft, published, availablePresets: THEME_PRESET_OPTIONS };
}

export async function updateAdminThemeDraft(tenantId: string, values: ThemeDraftValues) {
  assertTenantScope(tenantId);
  const db = await getDb();
  const [saved] = await db.update(tenantThemes).set({
    templateKey: values.templateKey,
    primaryColor: values.primaryColor,
    secondaryColor: values.secondaryColor,
    accentColor: values.accentColor,
    backgroundColor: values.backgroundColor,
    fontPreset: values.fontPreset,
    buttonStyle: values.buttonStyle,
    cardStyle: values.cardStyle,
    sectionStyle: values.sectionStyle,
    version: sql`${tenantThemes.version} + 1`,
    updatedAt: sql`CURRENT_TIMESTAMP`,
  }).where(and(eq(tenantThemes.tenantId, tenantId), eq(tenantThemes.status, "draft"))).returning();
  if (!saved) throw new AdminThemeConfigurationError("Draft theme is missing");
  return mapThemeRow(saved);
}

export async function publishAdminTheme(tenantId: string, userId: string) {
  assertTenantScope(tenantId);
  const rows = await getThemeRows(tenantId);
  const { draft, published } = requireThemeRows(rows);
  const now = new Date().toISOString();
  const db = await getDb();
  const currentDraft = rows.find((row) => row.status === "draft");
  const currentPublished = rows.find((row) => row.status === "published");
  if (!currentDraft || !currentPublished) throw new AdminThemeConfigurationError();
  const draftStillCurrent = sql`EXISTS (SELECT 1 FROM tenant_themes AS draft_check WHERE draft_check.tenant_id = ${tenantId} AND draft_check.status = 'draft' AND draft_check.version = ${draft.version})`;
  const publishStatement = db.update(tenantThemes).set({
    templateKey: draft.values.templateKey,
    primaryColor: draft.values.primaryColor,
    secondaryColor: draft.values.secondaryColor,
    accentColor: draft.values.accentColor,
    backgroundColor: draft.values.backgroundColor,
    fontPreset: draft.values.fontPreset,
    buttonStyle: draft.values.buttonStyle,
    cardStyle: draft.values.cardStyle,
    sectionStyle: draft.values.sectionStyle,
    version: draft.version,
    publishedBy: userId,
    publishedAt: now,
    updatedAt: sql`CURRENT_TIMESTAMP`,
  }).where(and(eq(tenantThemes.id, currentPublished.id), eq(tenantThemes.tenantId, tenantId), eq(tenantThemes.status, "published"), eq(tenantThemes.version, published.version), draftStillCurrent));
  const draftStatement = db.update(tenantThemes).set({
    publishedBy: null,
    publishedAt: null,
    version: draft.version,
    updatedAt: sql`CURRENT_TIMESTAMP`,
  }).where(and(eq(tenantThemes.id, currentDraft.id), eq(tenantThemes.tenantId, tenantId), eq(tenantThemes.status, "draft"), eq(tenantThemes.version, draft.version)));
  await db.batch([publishStatement, draftStatement]);
  const state = await getAdminThemeState(tenantId);
  if (state.published.version !== draft.version || JSON.stringify(state.published.values) !== JSON.stringify(draft.values)) throw new AdminThemeConfigurationError("Theme publish verification failed");
  return { state, previousVersion: published.version, newVersion: state.published.version };
}

export async function resetAdminThemeDraft(tenantId: string) {
  assertTenantScope(tenantId);
  const state = await getAdminThemeState(tenantId);
  const db = await getDb();
  const [saved] = await db.update(tenantThemes).set({
    templateKey: state.published.values.templateKey,
    primaryColor: state.published.values.primaryColor,
    secondaryColor: state.published.values.secondaryColor,
    accentColor: state.published.values.accentColor,
    backgroundColor: state.published.values.backgroundColor,
    fontPreset: state.published.values.fontPreset,
    buttonStyle: state.published.values.buttonStyle,
    cardStyle: state.published.values.cardStyle,
    sectionStyle: state.published.values.sectionStyle,
    version: sql`${tenantThemes.version} + 1`,
    publishedBy: null,
    publishedAt: null,
    updatedAt: sql`CURRENT_TIMESTAMP`,
  }).where(and(eq(tenantThemes.id, state.draft.id), eq(tenantThemes.tenantId, tenantId), eq(tenantThemes.status, "draft"))).returning();
  if (!saved) throw new AdminThemeConfigurationError("Draft theme is missing");
  return mapThemeRow(saved);
}
