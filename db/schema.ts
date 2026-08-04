import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const inquiries = sqliteTable("inquiries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
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
});

export const plannerCities = sqliteTable("planner_cities", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
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
  tenantId: text("tenant_id").notNull(),
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

export type Inquiry = typeof inquiries.$inferSelect;
export type NewInquiry = typeof inquiries.$inferInsert;
export type PlannerCity = typeof plannerCities.$inferSelect;
export type NewPlannerCity = typeof plannerCities.$inferInsert;
export type PlannerDestination = typeof plannerDestinations.$inferSelect;
export type NewPlannerDestination = typeof plannerDestinations.$inferInsert;
