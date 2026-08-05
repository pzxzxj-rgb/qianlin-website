CREATE TABLE `tenant_contact_channels` (
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
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_tenant_contact_channels_tenant_status_order` ON `tenant_contact_channels` (`tenant_id`,`status`,`display_order`);--> statement-breakpoint
CREATE TABLE `tenant_hero_slides` (
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
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_tenant_hero_slides_tenant_status_order` ON `tenant_hero_slides` (`tenant_id`,`status`,`display_order`);--> statement-breakpoint
CREATE TABLE `tenant_site_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`company_name_zh` text DEFAULT '' NOT NULL,
	`company_name_en` text DEFAULT '' NOT NULL,
	`description_zh` text DEFAULT '' NOT NULL,
	`description_en` text DEFAULT '' NOT NULL,
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
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_tenant_site_profiles_tenant` ON `tenant_site_profiles` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `idx_tenant_site_profiles_tenant_status` ON `tenant_site_profiles` (`tenant_id`,`status`);--> statement-breakpoint
CREATE TABLE `tenants` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name_zh` text NOT NULL,
	`name_en` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`default_language` text DEFAULT 'zh' NOT NULL,
	`is_demo` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_tenants_slug` ON `tenants` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_tenants_status` ON `tenants` (`status`);--> statement-breakpoint
ALTER TABLE `inquiries` ADD `tenant_id` text DEFAULT 'qianlin-travel' NOT NULL;
--> statement-breakpoint
INSERT OR IGNORE INTO `tenants` (`id`, `slug`, `name_zh`, `name_en`, `status`, `default_language`, `is_demo`) VALUES ('qianlin-travel', 'qianlin-travel', '黔林旅行社', 'Qianlin Travel', 'active', 'zh', 0);
--> statement-breakpoint
INSERT OR IGNORE INTO `tenants` (`id`, `slug`, `name_zh`, `name_en`, `status`, `default_language`, `is_demo`) VALUES ('yunnan-demo', 'yunnan-demo', '云南旅行社演示站', 'Yunnan Demo Travel', 'active', 'zh', 1);
--> statement-breakpoint
UPDATE `inquiries` SET `tenant_id` = 'qianlin-travel' WHERE `tenant_id` IS NULL OR `tenant_id` = '';
--> statement-breakpoint
INSERT OR IGNORE INTO `tenant_site_profiles` (`id`, `tenant_id`, `company_name_zh`, `company_name_en`, `description_zh`, `description_en`, `address_zh`, `address_en`, `logo_mark`, `logo_image_url`, `about_image_url`, `about_image_alt_zh`, `about_image_alt_en`, `customize_image_url`, `customize_image_alt_zh`, `customize_image_alt_en`, `status`) VALUES ('qianlin-profile', 'qianlin-travel', '黔林旅行社', 'Qianlin Travel', '黔林旅行社是一家专注于贵州旅游的本地旅行服务公司。', 'Thoughtful private journeys and curated tours through Guizhou, China with a local travel team.', '贵州省贵阳市云岩区毓秀街道飞山街祥源大厦A栋1单元7层2号', '', 'Q', '', '/images/hero/hero-07.webp', '贵州山间村寨主题视觉图', 'Guizhou mountain village travel visual', '/images/guizhou/customize-mountains.png', '贵州层叠群山主题视觉图', 'Layered Guizhou mountains travel visual', 'published');
--> statement-breakpoint
INSERT OR IGNORE INTO `tenant_site_profiles` (`id`, `tenant_id`, `company_name_zh`, `company_name_en`, `description_zh`, `description_en`, `address_zh`, `address_en`, `logo_mark`, `logo_image_url`, `about_image_url`, `about_image_alt_zh`, `about_image_alt_en`, `customize_image_url`, `customize_image_alt_zh`, `customize_image_alt_en`, `status`) VALUES ('yunnan-demo-profile', 'yunnan-demo', '云南旅行社演示站', 'Yunnan Demo Travel', '云南旅游网站演示租户。', 'A demo travel tenant for future SaaS presentation.', '', '', 'Y', '', '', '', '', '', '', '', 'published');
--> statement-breakpoint
INSERT OR IGNORE INTO `tenant_contact_channels` (`id`, `tenant_id`, `type`, `label_zh`, `label_en`, `value`, `href`, `display_order`, `status`) VALUES ('qianlin-phone', 'qianlin-travel', 'phone', '电话', 'Phone', '18985127882', 'tel:+8618985127882', 10, 'published');
--> statement-breakpoint
INSERT OR IGNORE INTO `tenant_contact_channels` (`id`, `tenant_id`, `type`, `label_zh`, `label_en`, `value`, `href`, `display_order`, `status`) VALUES ('qianlin-email', 'qianlin-travel', 'email', '邮箱', 'Email', '624667375@qq.com', 'mailto:624667375@qq.com', 20, 'published');
--> statement-breakpoint
INSERT OR IGNORE INTO `tenant_contact_channels` (`id`, `tenant_id`, `type`, `label_zh`, `label_en`, `value`, `href`, `display_order`, `status`) VALUES ('qianlin-wechat', 'qianlin-travel', 'wechat', '微信', 'WeChat', 'powwow58', NULL, 30, 'published');
--> statement-breakpoint
INSERT OR IGNORE INTO `tenant_hero_slides` (`id`, `tenant_id`, `image_url`, `alt_zh`, `alt_en`, `desktop_position`, `mobile_position`, `display_order`, `status`) VALUES ('qianlin-hero-01', 'qianlin-travel', '/images/hero/hero-01.webp', '贵州山水主题旅行视觉图', 'Guizhou landscape travel visual', 'center center', '50% center', 10, 'published');
--> statement-breakpoint
INSERT OR IGNORE INTO `tenant_hero_slides` (`id`, `tenant_id`, `image_url`, `alt_zh`, `alt_en`, `desktop_position`, `mobile_position`, `display_order`, `status`) VALUES ('qianlin-hero-02', 'qianlin-travel', '/images/hero/hero-02.webp', '贵州自然风光主题视觉图', 'Guizhou nature-inspired travel visual', '52% center', '50% center', 20, 'published');
