CREATE TABLE `tenant_tours` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`slug` text NOT NULL,
	`title_zh` text NOT NULL,
	`title_en` text NOT NULL,
	`description_zh` text NOT NULL,
	`description_en` text NOT NULL,
	`duration_zh` text DEFAULT '' NOT NULL,
	`duration_en` text DEFAULT '' NOT NULL,
	`tag_zh` text DEFAULT '' NOT NULL,
	`tag_en` text DEFAULT '' NOT NULL,
	`price_text_zh` text DEFAULT '' NOT NULL,
	`price_text_en` text DEFAULT '' NOT NULL,
	`image_url` text DEFAULT '' NOT NULL,
	`image_alt_zh` text DEFAULT '' NOT NULL,
	`image_alt_en` text DEFAULT '' NOT NULL,
	`featured` integer DEFAULT false NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "ck_tenant_tours_status" CHECK("tenant_tours"."status" in ('draft', 'published', 'archived')),
	CONSTRAINT "ck_tenant_tours_featured" CHECK("tenant_tours"."featured" in (0, 1)),
	CONSTRAINT "ck_tenant_tours_display_order" CHECK("tenant_tours"."display_order" between 0 and 1000 and "tenant_tours"."display_order" = cast("tenant_tours"."display_order" as integer))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_tenant_tours_tenant_slug` ON `tenant_tours` (`tenant_id`,`slug`);--> statement-breakpoint
CREATE INDEX `idx_tenant_tours_tenant_status_featured_order` ON `tenant_tours` (`tenant_id`,`status`,`featured`,`display_order`);--> statement-breakpoint
CREATE INDEX `idx_tenant_tours_tenant_status_order` ON `tenant_tours` (`tenant_id`,`status`,`display_order`);
