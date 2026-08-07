PRAGMA foreign_keys=OFF;--> statement-breakpoint
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
	CONSTRAINT "ck_inquiries_status" CHECK("__new_inquiries"."status" in ('new', 'contacted', 'following_up', 'completed', 'closed'))
);
--> statement-breakpoint
INSERT INTO `__new_inquiries`("id", "tenant_id", "name", "phone", "wechat", "email", "location", "travel_date", "travelers", "duration", "tour_name", "places", "message", "privacy_consent", "status", "created_at") SELECT "id", "tenant_id", "name", "phone", "wechat", "email", "location", "travel_date", "travelers", "duration", "tour_name", "places", "message", "privacy_consent", "status", "created_at" FROM `inquiries`;--> statement-breakpoint
DROP TABLE `inquiries`;--> statement-breakpoint
ALTER TABLE `__new_inquiries` RENAME TO `inquiries`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_inquiries_tenant_status_created` ON `inquiries` (`tenant_id`,`status`,`created_at`);