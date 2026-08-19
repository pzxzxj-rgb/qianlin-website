-- Add one controlled draft and one controlled published theme per existing tenant.
-- Theme values are explicit fields; no CSS, HTML, JavaScript, or arbitrary tokens
-- are stored in this table.
CREATE TABLE `tenant_themes` (
  `id` text PRIMARY KEY NOT NULL,
  `tenant_id` text NOT NULL,
  `status` text DEFAULT 'draft' NOT NULL,
  `template_key` text DEFAULT 'modern' NOT NULL,
  `primary_color` text DEFAULT '#173F36' NOT NULL,
  `secondary_color` text DEFAULT '#DCE6DC' NOT NULL,
  `accent_color` text DEFAULT '#C7A878' NOT NULL,
  `background_color` text DEFAULT '#FBFAF7' NOT NULL,
  `font_preset` text DEFAULT 'modern' NOT NULL,
  `button_style` text DEFAULT 'rounded' NOT NULL,
  `card_style` text DEFAULT 'elevated' NOT NULL,
  `section_style` text DEFAULT 'clean' NOT NULL,
  `version` integer DEFAULT 1 NOT NULL,
  `published_by` text,
  `published_at` text,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE restrict,
  FOREIGN KEY (`published_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
  CONSTRAINT "ck_tenant_themes_status" CHECK("tenant_themes"."status" in ('draft', 'published')),
  CONSTRAINT "ck_tenant_themes_template" CHECK("tenant_themes"."template_key" in ('modern', 'natural', 'elegant', 'youthful')),
  CONSTRAINT "ck_tenant_themes_font" CHECK("tenant_themes"."font_preset" in ('modern', 'elegant', 'editorial', 'friendly')),
  CONSTRAINT "ck_tenant_themes_button" CHECK("tenant_themes"."button_style" in ('rounded', 'square', 'pill')),
  CONSTRAINT "ck_tenant_themes_card" CHECK("tenant_themes"."card_style" in ('flat', 'bordered', 'elevated')),
  CONSTRAINT "ck_tenant_themes_section" CHECK("tenant_themes"."section_style" in ('clean', 'soft', 'contrast')),
  CONSTRAINT "ck_tenant_themes_version" CHECK("tenant_themes"."version" > 0)
);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_tenant_themes_tenant_status` ON `tenant_themes` (`tenant_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_tenant_themes_tenant_updated` ON `tenant_themes` (`tenant_id`,`updated_at`);--> statement-breakpoint
INSERT OR IGNORE INTO `tenant_themes` (`id`, `tenant_id`, `status`, `template_key`, `primary_color`, `secondary_color`, `accent_color`, `background_color`, `font_preset`, `button_style`, `card_style`, `section_style`, `version`)
SELECT 'theme-' || `id` || '-draft', `id`, 'draft', 'modern', '#173F36', '#DCE6DC', '#C7A878', '#FBFAF7', 'modern', 'rounded', 'elevated', 'clean', 1 FROM `tenants`;--> statement-breakpoint
INSERT OR IGNORE INTO `tenant_themes` (`id`, `tenant_id`, `status`, `template_key`, `primary_color`, `secondary_color`, `accent_color`, `background_color`, `font_preset`, `button_style`, `card_style`, `section_style`, `version`)
SELECT 'theme-' || `id` || '-published', `id`, 'published', 'modern', '#173F36', '#DCE6DC', '#C7A878', '#FBFAF7', 'modern', 'rounded', 'elevated', 'clean', 1 FROM `tenants`;
