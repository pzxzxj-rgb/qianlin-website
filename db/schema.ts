import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

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

export type Inquiry = typeof inquiries.$inferSelect;
export type NewInquiry = typeof inquiries.$inferInsert;
