import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const tenants = sqliteTable("tenants", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull(),
  nameZh: text("name_zh").notNull(),
  nameEn: text("name_en").notNull(),
  status: text("status").notNull().default("active"),
  siteStatus: text("site_status").notNull().default("configuring"),
  defaultLanguage: text("default_language").notNull().default("zh"),
  isDemo: integer("is_demo", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  slugUnique: uniqueIndex("uq_tenants_slug").on(table.slug),
  statusIndex: index("idx_tenants_status").on(table.status),
  statusCheck: check("ck_tenants_status", sql`${table.status} in ('active', 'suspended', 'archived')`),
  siteStatusCheck: check("ck_tenants_site_status", sql`${table.siteStatus} in ('configuring', 'published')`),
  languageCheck: check("ck_tenants_default_language", sql`${table.defaultLanguage} in ('zh', 'en')`),
}));

export const inquiries = sqliteTable("inquiries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "restrict" }),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  wechat: text("wechat").notNull().default(""),
  email: text("email").notNull().default(""),
  location: text("location").notNull().default(""),
  travelDate: text("travel_date").notNull().default(""),
  travelers: text("travelers").notNull().default(""),
  duration: text("duration").notNull().default(""),
  tourName: text("tour_name").notNull().default(""),
  places: text("places").notNull().default(""),
  message: text("message").notNull().default(""),
  privacyConsent: integer("privacy_consent", { mode: "boolean" }).notNull().default(false),
  status: text("status").notNull().default("new"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  tenantStatusCreatedIndex: index("idx_inquiries_tenant_status_created").on(table.tenantId, table.status, table.createdAt),
  statusCheck: check("ck_inquiries_status", sql`${table.status} in ('new', 'contacted', 'following_up', 'completed', 'closed')`),
}));

export const tenantSiteProfiles = sqliteTable("tenant_site_profiles", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "restrict" }),
  companyNameZh: text("company_name_zh").notNull().default(""),
  companyNameEn: text("company_name_en").notNull().default(""),
  descriptionZh: text("description_zh").notNull().default(""),
  descriptionEn: text("description_en").notNull().default(""),
  primaryRegionZh: text("primary_region_zh").notNull().default(""),
  primaryRegionEn: text("primary_region_en").notNull().default(""),
  addressZh: text("address_zh").notNull().default(""),
  addressEn: text("address_en").notNull().default(""),
  logoMark: text("logo_mark").notNull().default(""),
  logoImageUrl: text("logo_image_url").notNull().default(""),
  aboutImageUrl: text("about_image_url").notNull().default(""),
  aboutImageAltZh: text("about_image_alt_zh").notNull().default(""),
  aboutImageAltEn: text("about_image_alt_en").notNull().default(""),
  customizeImageUrl: text("customize_image_url").notNull().default(""),
  customizeImageAltZh: text("customize_image_alt_zh").notNull().default(""),
  customizeImageAltEn: text("customize_image_alt_en").notNull().default(""),
  status: text("status").notNull().default("published"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  tenantUnique: uniqueIndex("uq_tenant_site_profiles_tenant").on(table.tenantId),
  tenantStatusIndex: index("idx_tenant_site_profiles_tenant_status").on(table.tenantId, table.status),
  statusCheck: check("ck_tenant_site_profiles_status", sql`${table.status} in ('draft', 'published', 'archived')`),
}));

export const tenantContactChannels = sqliteTable("tenant_contact_channels", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "restrict" }),
  type: text("type").notNull(),
  labelZh: text("label_zh").notNull().default(""),
  labelEn: text("label_en").notNull().default(""),
  value: text("value").notNull(),
  href: text("href"),
  displayOrder: integer("display_order").notNull().default(0),
  status: text("status").notNull().default("published"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  tenantStatusOrderIndex: index("idx_tenant_contact_channels_tenant_status_order").on(table.tenantId, table.status, table.displayOrder),
  statusCheck: check("ck_tenant_contact_channels_status", sql`${table.status} in ('draft', 'published', 'archived')`),
}));

export const tenantTours = sqliteTable("tenant_tours", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "restrict" }),
  slug: text("slug").notNull(),
  titleZh: text("title_zh").notNull(),
  titleEn: text("title_en").notNull(),
  descriptionZh: text("description_zh").notNull(),
  descriptionEn: text("description_en").notNull(),
  durationZh: text("duration_zh").notNull().default(""),
  durationEn: text("duration_en").notNull().default(""),
  tagZh: text("tag_zh").notNull().default(""),
  tagEn: text("tag_en").notNull().default(""),
  priceTextZh: text("price_text_zh").notNull().default(""),
  priceTextEn: text("price_text_en").notNull().default(""),
  imageUrl: text("image_url").notNull().default(""),
  imageAltZh: text("image_alt_zh").notNull().default(""),
  imageAltEn: text("image_alt_en").notNull().default(""),
  featured: integer("featured", { mode: "boolean" }).notNull().default(false),
  displayOrder: integer("display_order").notNull().default(0),
  status: text("status").notNull().default("draft"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  tenantSlugUnique: uniqueIndex("uq_tenant_tours_tenant_slug").on(table.tenantId, table.slug),
  tenantStatusFeaturedOrderIndex: index("idx_tenant_tours_tenant_status_featured_order").on(table.tenantId, table.status, table.featured, table.displayOrder),
  tenantStatusOrderIndex: index("idx_tenant_tours_tenant_status_order").on(table.tenantId, table.status, table.displayOrder),
  statusCheck: check("ck_tenant_tours_status", sql`${table.status} in ('draft', 'published', 'archived')`),
  featuredCheck: check("ck_tenant_tours_featured", sql`${table.featured} in (0, 1)`),
  displayOrderCheck: check("ck_tenant_tours_display_order", sql`${table.displayOrder} between 0 and 1000 and ${table.displayOrder} = cast(${table.displayOrder} as integer)`),
}));

export const tenantHeroSlides = sqliteTable("tenant_hero_slides", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "restrict" }),
  imageUrl: text("image_url").notNull(),
  altZh: text("alt_zh").notNull().default(""),
  altEn: text("alt_en").notNull().default(""),
  desktopPosition: text("desktop_position").notNull().default("center center"),
  mobilePosition: text("mobile_position").notNull().default("center center"),
  displayOrder: integer("display_order").notNull().default(0),
  status: text("status").notNull().default("published"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  tenantStatusOrderIndex: index("idx_tenant_hero_slides_tenant_status_order").on(table.tenantId, table.status, table.displayOrder),
  statusCheck: check("ck_tenant_hero_slides_status", sql`${table.status} in ('draft', 'published', 'archived')`),
}));

export const plannerProvinces = sqliteTable("planner_provinces", {
  id: text("id").primaryKey(),
  code: text("code").notNull(),
  nameZh: text("name_zh").notNull(),
  nameEn: text("name_en").notNull(),
  displayOrder: integer("display_order").notNull().default(0),
  status: text("status").notNull().default("published"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  codeUnique: uniqueIndex("uq_planner_provinces_code").on(table.code),
  statusOrderIndex: index("idx_planner_provinces_status_order").on(table.status, table.displayOrder),
}));

export const plannerCities = sqliteTable("planner_cities", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "restrict" }),
  provinceCode: text("province_code").notNull().default("guizhou"),
  code: text("code").notNull(),
  nameZh: text("name_zh").notNull(),
  nameEn: text("name_en").notNull(),
  availableAsStart: integer("available_as_start", { mode: "boolean" }).notNull().default(true),
  availableAsEnd: integer("available_as_end", { mode: "boolean" }).notNull().default(true),
  displayOrder: integer("display_order").notNull().default(0),
  status: text("status").notNull().default("published"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  tenantCodeUnique: uniqueIndex("uq_planner_cities_tenant_code").on(table.tenantId, table.code),
  tenantStatusOrderIndex: index("idx_planner_cities_tenant_status_order").on(table.tenantId, table.status, table.displayOrder),
}));

export const plannerDestinations = sqliteTable("planner_destinations", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "restrict" }),
  provinceCode: text("province_code").notNull().default("guizhou"),
  slug: text("slug").notNull(),
  cityCode: text("city_code"),
  nameZh: text("name_zh").notNull(),
  nameEn: text("name_en").notNull(),
  descriptionZh: text("description_zh").notNull().default(""),
  descriptionEn: text("description_en").notNull().default(""),
  imageUrl: text("image_url").notNull().default(""),
  cardSize: text("card_size").notNull().default("small"),
  regionZh: text("region_zh").notNull(),
  regionEn: text("region_en").notNull(),
  routeOrder: integer("route_order").notNull().default(0),
  overnightZh: text("overnight_zh").notNull().default(""),
  overnightEn: text("overnight_en").notNull().default(""),
  recommendedVisitHours: integer("recommended_visit_hours"),
  majorAttraction: integer("major_attraction", { mode: "boolean" }).notNull().default(false),
  availableForPlanning: integer("available_for_planning", { mode: "boolean" }).notNull().default(true),
  showOnHomepage: integer("show_on_homepage", { mode: "boolean" }).notNull().default(true),
  displayOrder: integer("display_order").notNull().default(0),
  status: text("status").notNull().default("published"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  tenantSlugUnique: uniqueIndex("uq_planner_destinations_tenant_slug").on(table.tenantId, table.slug),
  tenantStatusOrderIndex: index("idx_planner_destinations_tenant_status_order").on(table.tenantId, table.status, table.displayOrder),
  planningOrderIndex: index("idx_planner_destinations_planning_order").on(table.tenantId, table.status, table.availableForPlanning, table.routeOrder),
  homepageOrderIndex: index("idx_planner_destinations_homepage_order").on(table.tenantId, table.status, table.showOnHomepage, table.displayOrder),
}));

export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;
export type Inquiry = typeof inquiries.$inferSelect;
export type NewInquiry = typeof inquiries.$inferInsert;
export type TenantSiteProfile = typeof tenantSiteProfiles.$inferSelect;
export type NewTenantSiteProfile = typeof tenantSiteProfiles.$inferInsert;
export type TenantContactChannel = typeof tenantContactChannels.$inferSelect;
export type NewTenantContactChannel = typeof tenantContactChannels.$inferInsert;
export type TenantTour = typeof tenantTours.$inferSelect;
export type NewTenantTour = typeof tenantTours.$inferInsert;
export type TenantHeroSlide = typeof tenantHeroSlides.$inferSelect;
export type NewTenantHeroSlide = typeof tenantHeroSlides.$inferInsert;
export type PlannerProvince = typeof plannerProvinces.$inferSelect;
export type NewPlannerProvince = typeof plannerProvinces.$inferInsert;
export type PlannerCity = typeof plannerCities.$inferSelect;
export type NewPlannerCity = typeof plannerCities.$inferInsert;
export type PlannerDestination = typeof plannerDestinations.$inferSelect;
export type NewPlannerDestination = typeof plannerDestinations.$inferInsert;
