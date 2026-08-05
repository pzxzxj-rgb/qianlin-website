PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_tenants` (
  `id` text PRIMARY KEY NOT NULL,
  `slug` text NOT NULL,
  `name_zh` text NOT NULL,
  `name_en` text NOT NULL,
  `status` text DEFAULT 'active' NOT NULL,
  `site_status` text DEFAULT 'configuring' NOT NULL,
  `default_language` text DEFAULT 'zh' NOT NULL,
  `is_demo` integer DEFAULT false NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT "ck_tenants_status" CHECK("status" in ('active', 'suspended', 'archived')),
  CONSTRAINT "ck_tenants_site_status" CHECK("site_status" in ('configuring', 'published')),
  CONSTRAINT "ck_tenants_default_language" CHECK("default_language" in ('zh', 'en'))
);--> statement-breakpoint
INSERT INTO `__new_tenants`(`id`, `slug`, `name_zh`, `name_en`, `status`, `site_status`, `default_language`, `is_demo`, `created_at`, `updated_at`)
SELECT `id`, `slug`, `name_zh`, `name_en`, `status`, CASE WHEN `id` IN ('qianlin-travel', 'yunnan-demo') THEN 'published' ELSE 'configuring' END, `default_language`, `is_demo`, `created_at`, `updated_at` FROM `tenants`;--> statement-breakpoint
DROP TABLE `tenants`;--> statement-breakpoint
ALTER TABLE `__new_tenants` RENAME TO `tenants`;--> statement-breakpoint
CREATE UNIQUE INDEX `uq_tenants_slug` ON `tenants` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_tenants_status` ON `tenants` (`status`);--> statement-breakpoint
CREATE TABLE `__new_inquiries` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `tenant_id` text NOT NULL,
  `name` text NOT NULL,
  `phone` text NOT NULL,
  `wechat` text DEFAULT '' NOT NULL,
  `email` text DEFAULT '' NOT NULL,
  `location` text DEFAULT '' NOT NULL,
  `travel_date` text DEFAULT '' NOT NULL,
  `travelers` text DEFAULT '' NOT NULL,
  `duration` text DEFAULT '' NOT NULL,
  `tour_name` text DEFAULT '' NOT NULL,
  `places` text DEFAULT '' NOT NULL,
  `message` text DEFAULT '' NOT NULL,
  `privacy_consent` integer DEFAULT false NOT NULL,
  `status` text DEFAULT 'new' NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE restrict,
  CONSTRAINT "ck_inquiries_status" CHECK(`status` in ('new', 'contacted', 'closed'))
);--> statement-breakpoint
INSERT INTO `__new_inquiries`(`id`, `tenant_id`, `name`, `phone`, `wechat`, `email`, `location`, `travel_date`, `travelers`, `duration`, `tour_name`, `places`, `message`, `privacy_consent`, `status`, `created_at`)
SELECT `id`, COALESCE(NULLIF(`tenant_id`, ''), 'qianlin-travel'), `name`, `phone`, `wechat`, `email`, `location`, `travel_date`, `travelers`, `duration`, `tour_name`, `places`, `message`, `privacy_consent`, `status`, `created_at` FROM `inquiries`;--> statement-breakpoint
DROP TABLE `inquiries`;--> statement-breakpoint
ALTER TABLE `__new_inquiries` RENAME TO `inquiries`;--> statement-breakpoint
CREATE INDEX `idx_inquiries_tenant_status_created` ON `inquiries` (`tenant_id`, `status`, `created_at`);--> statement-breakpoint
CREATE TABLE `__new_tenant_site_profiles` (
  `id` text PRIMARY KEY NOT NULL,
  `tenant_id` text NOT NULL,
  `company_name_zh` text DEFAULT '' NOT NULL,
  `company_name_en` text DEFAULT '' NOT NULL,
  `description_zh` text DEFAULT '' NOT NULL,
  `description_en` text DEFAULT '' NOT NULL,
  `primary_region_zh` text DEFAULT '' NOT NULL,
  `primary_region_en` text DEFAULT '' NOT NULL,
  `address_zh` text DEFAULT '' NOT NULL,
  `address_en` text DEFAULT '' NOT NULL,
  `logo_mark` text DEFAULT '' NOT NULL,
  `logo_image_url` text DEFAULT '' NOT NULL,
  `about_image_url` text DEFAULT '' NOT NULL,
  `about_image_alt_zh` text DEFAULT '' NOT NULL,
  `about_image_alt_en` text DEFAULT '' NOT NULL,
  `customize_image_url` text DEFAULT '' NOT NULL,
  `customize_image_alt_zh` text DEFAULT '' NOT NULL,
  `customize_image_alt_en` text DEFAULT '' NOT NULL,
  `status` text DEFAULT 'published' NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE restrict,
  CONSTRAINT "ck_tenant_site_profiles_status" CHECK(`status` in ('draft', 'published', 'archived'))
);--> statement-breakpoint
INSERT INTO `__new_tenant_site_profiles`(`id`, `tenant_id`, `company_name_zh`, `company_name_en`, `description_zh`, `description_en`, `primary_region_zh`, `primary_region_en`, `address_zh`, `address_en`, `logo_mark`, `logo_image_url`, `about_image_url`, `about_image_alt_zh`, `about_image_alt_en`, `customize_image_url`, `customize_image_alt_zh`, `customize_image_alt_en`, `status`, `created_at`, `updated_at`)
SELECT `id`, `tenant_id`, `company_name_zh`, `company_name_en`, `description_zh`, `description_en`, '', '', `address_zh`, `address_en`, `logo_mark`, `logo_image_url`, `about_image_url`, `about_image_alt_zh`, `about_image_alt_en`, `customize_image_url`, `customize_image_alt_zh`, `customize_image_alt_en`, `status`, `created_at`, `updated_at` FROM `tenant_site_profiles`;--> statement-breakpoint
DROP TABLE `tenant_site_profiles`;--> statement-breakpoint
ALTER TABLE `__new_tenant_site_profiles` RENAME TO `tenant_site_profiles`;--> statement-breakpoint
CREATE UNIQUE INDEX `uq_tenant_site_profiles_tenant` ON `tenant_site_profiles` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `idx_tenant_site_profiles_tenant_status` ON `tenant_site_profiles` (`tenant_id`, `status`);--> statement-breakpoint
CREATE TABLE `__new_tenant_contact_channels` (
  `id` text PRIMARY KEY NOT NULL,
  `tenant_id` text NOT NULL,
  `type` text NOT NULL,
  `label_zh` text DEFAULT '' NOT NULL,
  `label_en` text DEFAULT '' NOT NULL,
  `value` text NOT NULL,
  `href` text,
  `display_order` integer DEFAULT 0 NOT NULL,
  `status` text DEFAULT 'published' NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE restrict,
  CONSTRAINT "ck_tenant_contact_channels_status" CHECK(`status` in ('draft', 'published', 'archived'))
);--> statement-breakpoint
INSERT INTO `__new_tenant_contact_channels`(`id`, `tenant_id`, `type`, `label_zh`, `label_en`, `value`, `href`, `display_order`, `status`, `created_at`, `updated_at`)
SELECT `id`, `tenant_id`, `type`, `label_zh`, `label_en`, `value`, `href`, `display_order`, `status`, `created_at`, `updated_at` FROM `tenant_contact_channels`;--> statement-breakpoint
DROP TABLE `tenant_contact_channels`;--> statement-breakpoint
ALTER TABLE `__new_tenant_contact_channels` RENAME TO `tenant_contact_channels`;--> statement-breakpoint
CREATE INDEX `idx_tenant_contact_channels_tenant_status_order` ON `tenant_contact_channels` (`tenant_id`, `status`, `display_order`);--> statement-breakpoint
CREATE TABLE `__new_tenant_hero_slides` (
  `id` text PRIMARY KEY NOT NULL,
  `tenant_id` text NOT NULL,
  `image_url` text NOT NULL,
  `alt_zh` text DEFAULT '' NOT NULL,
  `alt_en` text DEFAULT '' NOT NULL,
  `desktop_position` text DEFAULT 'center center' NOT NULL,
  `mobile_position` text DEFAULT 'center center' NOT NULL,
  `display_order` integer DEFAULT 0 NOT NULL,
  `status` text DEFAULT 'published' NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE restrict,
  CONSTRAINT "ck_tenant_hero_slides_status" CHECK(`status` in ('draft', 'published', 'archived'))
);--> statement-breakpoint
INSERT INTO `__new_tenant_hero_slides`(`id`, `tenant_id`, `image_url`, `alt_zh`, `alt_en`, `desktop_position`, `mobile_position`, `display_order`, `status`, `created_at`, `updated_at`)
SELECT `id`, `tenant_id`, `image_url`, `alt_zh`, `alt_en`, `desktop_position`, `mobile_position`, `display_order`, `status`, `created_at`, `updated_at` FROM `tenant_hero_slides`;--> statement-breakpoint
DROP TABLE `tenant_hero_slides`;--> statement-breakpoint
ALTER TABLE `__new_tenant_hero_slides` RENAME TO `tenant_hero_slides`;--> statement-breakpoint
CREATE INDEX `idx_tenant_hero_slides_tenant_status_order` ON `tenant_hero_slides` (`tenant_id`, `status`, `display_order`);--> statement-breakpoint
CREATE TABLE `__new_planner_provinces` (
  `id` text PRIMARY KEY NOT NULL,
  `code` text NOT NULL,
  `name_zh` text NOT NULL,
  `name_en` text NOT NULL,
  `display_order` integer DEFAULT 0 NOT NULL,
  `status` text DEFAULT 'published' NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT "ck_planner_provinces_status" CHECK(`status` in ('draft', 'published', 'archived'))
);--> statement-breakpoint
INSERT INTO `__new_planner_provinces`(`id`, `code`, `name_zh`, `name_en`, `display_order`, `status`, `created_at`, `updated_at`)
SELECT `id`, `code`, `name_zh`, `name_en`, `display_order`, `status`, `created_at`, `updated_at` FROM `planner_provinces`;--> statement-breakpoint
DROP TABLE `planner_provinces`;--> statement-breakpoint
ALTER TABLE `__new_planner_provinces` RENAME TO `planner_provinces`;--> statement-breakpoint
CREATE UNIQUE INDEX `uq_planner_provinces_code` ON `planner_provinces` (`code`);--> statement-breakpoint
CREATE INDEX `idx_planner_provinces_status_order` ON `planner_provinces` (`status`, `display_order`);--> statement-breakpoint
CREATE TABLE `__new_planner_cities` (
  `id` text PRIMARY KEY NOT NULL,
  `tenant_id` text NOT NULL,
  `province_code` text DEFAULT 'guizhou' NOT NULL,
  `code` text NOT NULL,
  `name_zh` text NOT NULL,
  `name_en` text NOT NULL,
  `available_as_start` integer DEFAULT true NOT NULL,
  `available_as_end` integer DEFAULT true NOT NULL,
  `display_order` integer DEFAULT 0 NOT NULL,
  `status` text DEFAULT 'published' NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE restrict,
  CONSTRAINT "ck_planner_cities_status" CHECK(`status` in ('draft', 'published', 'archived'))
);--> statement-breakpoint
INSERT INTO `__new_planner_cities`(`id`, `tenant_id`, `province_code`, `code`, `name_zh`, `name_en`, `available_as_start`, `available_as_end`, `display_order`, `status`, `created_at`, `updated_at`)
SELECT `id`, `tenant_id`, `province_code`, `code`, `name_zh`, `name_en`, `available_as_start`, `available_as_end`, `display_order`, `status`, `created_at`, `updated_at` FROM `planner_cities`;--> statement-breakpoint
DROP TABLE `planner_cities`;--> statement-breakpoint
ALTER TABLE `__new_planner_cities` RENAME TO `planner_cities`;--> statement-breakpoint
CREATE UNIQUE INDEX `uq_planner_cities_tenant_code` ON `planner_cities` (`tenant_id`, `code`);--> statement-breakpoint
CREATE INDEX `idx_planner_cities_tenant_status_order` ON `planner_cities` (`tenant_id`, `status`, `display_order`);--> statement-breakpoint
CREATE TABLE `__new_planner_destinations` (
  `id` text PRIMARY KEY NOT NULL,
  `tenant_id` text NOT NULL,
  `province_code` text DEFAULT 'guizhou' NOT NULL,
  `slug` text NOT NULL,
  `city_code` text,
  `name_zh` text NOT NULL,
  `name_en` text NOT NULL,
  `description_zh` text DEFAULT '' NOT NULL,
  `description_en` text DEFAULT '' NOT NULL,
  `image_url` text DEFAULT '' NOT NULL,
  `card_size` text DEFAULT 'small' NOT NULL,
  `region_zh` text NOT NULL,
  `region_en` text NOT NULL,
  `route_order` integer DEFAULT 0 NOT NULL,
  `overnight_zh` text DEFAULT '' NOT NULL,
  `overnight_en` text DEFAULT '' NOT NULL,
  `recommended_visit_hours` integer,
  `major_attraction` integer DEFAULT false NOT NULL,
  `available_for_planning` integer DEFAULT true NOT NULL,
  `show_on_homepage` integer DEFAULT true NOT NULL,
  `display_order` integer DEFAULT 0 NOT NULL,
  `status` text DEFAULT 'published' NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE restrict,
  CONSTRAINT "ck_planner_destinations_status" CHECK(`status` in ('draft', 'published', 'archived'))
);--> statement-breakpoint
INSERT INTO `__new_planner_destinations`(`id`, `tenant_id`, `province_code`, `slug`, `city_code`, `name_zh`, `name_en`, `description_zh`, `description_en`, `image_url`, `card_size`, `region_zh`, `region_en`, `route_order`, `overnight_zh`, `overnight_en`, `recommended_visit_hours`, `major_attraction`, `available_for_planning`, `show_on_homepage`, `display_order`, `status`, `created_at`, `updated_at`)
SELECT `id`, `tenant_id`, `province_code`, `slug`, `city_code`, `name_zh`, `name_en`, `description_zh`, `description_en`, `image_url`, `card_size`, `region_zh`, `region_en`, `route_order`, `overnight_zh`, `overnight_en`, `recommended_visit_hours`, `major_attraction`, `available_for_planning`, `show_on_homepage`, `display_order`, `status`, `created_at`, `updated_at` FROM `planner_destinations`;--> statement-breakpoint
DROP TABLE `planner_destinations`;--> statement-breakpoint
ALTER TABLE `__new_planner_destinations` RENAME TO `planner_destinations`;--> statement-breakpoint
CREATE UNIQUE INDEX `uq_planner_destinations_tenant_slug` ON `planner_destinations` (`tenant_id`, `slug`);--> statement-breakpoint
CREATE INDEX `idx_planner_destinations_tenant_status_order` ON `planner_destinations` (`tenant_id`, `status`, `display_order`);--> statement-breakpoint
CREATE INDEX `idx_planner_destinations_planning_order` ON `planner_destinations` (`tenant_id`, `status`, `available_for_planning`, `route_order`);--> statement-breakpoint
CREATE INDEX `idx_planner_destinations_homepage_order` ON `planner_destinations` (`tenant_id`, `status`, `show_on_homepage`, `display_order`);--> statement-breakpoint
UPDATE `tenants` SET `name_zh` = '黔林旅行社', `name_en` = 'Qianlin Travel', `site_status` = 'published', `default_language` = 'zh' WHERE `id` = 'qianlin-travel';--> statement-breakpoint
UPDATE `tenants` SET `name_zh` = '云途旅行（演示）', `name_en` = 'Yuntu Travel Demo', `site_status` = 'published', `default_language` = 'zh', `is_demo` = 1 WHERE `id` = 'yunnan-demo';--> statement-breakpoint
UPDATE `tenant_site_profiles` SET `company_name_zh` = '黔林旅行社', `company_name_en` = 'Qianlin Travel', `description_zh` = '专注贵州目的地的本地旅行服务，为你规划轻松、清晰、值得回味的旅程。', `description_en` = 'Thoughtful journeys and curated travel services shaped around each traveller.', `primary_region_zh` = '贵州', `primary_region_en` = 'Guizhou', `address_zh` = '贵州省贵阳市云岩区毓秀街道飞山街祥源大厦A栋1单元7层2号' WHERE `id` = 'qianlin-profile';--> statement-breakpoint
UPDATE `tenant_site_profiles` SET `company_name_zh` = '云途旅行（演示）', `company_name_en` = 'Yuntu Travel Demo', `description_zh` = '用于展示未来租户能力的演示站点，不代表真实旅行社业务。', `description_en` = 'A testing-only demo tenant for future SaaS capabilities; not a real travel agency.', `primary_region_zh` = '', `primary_region_en` = '' WHERE `id` = 'yunnan-demo-profile';--> statement-breakpoint
PRAGMA foreign_keys=ON;
