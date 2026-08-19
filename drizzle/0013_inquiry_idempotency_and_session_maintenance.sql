-- Add production-safe session cleanup indexing and a tenant-scoped inquiry
-- submission idempotency key. Existing inquiries receive a deterministic
-- legacy key so this migration does not invent a client submission identity.
CREATE INDEX `idx_sessions_expiry` ON `sessions` (`expires_at`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_inquiries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenant_id` text NOT NULL,
	`submission_id` text NOT NULL,
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
	`privacy_consent_at` text,
	`privacy_policy_version` text DEFAULT 'privacy-2026-08-04' NOT NULL,
	`retention_until` text,
	`anonymized_at` text,
	`status` text DEFAULT 'new' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "ck_inquiries_status" CHECK("__new_inquiries"."status" in ('new', 'contacted', 'following_up', 'completed', 'closed'))
);
--> statement-breakpoint
INSERT INTO `__new_inquiries`(`id`, `tenant_id`, `submission_id`, `name`, `phone`, `wechat`, `email`, `location`, `travel_date`, `travelers`, `duration`, `tour_name`, `places`, `message`, `privacy_consent`, `privacy_consent_at`, `privacy_policy_version`, `retention_until`, `anonymized_at`, `status`, `created_at`, `updated_at`)
SELECT `id`, `tenant_id`, 'legacy-' || CAST(`id` AS TEXT), `name`, `phone`, `wechat`, `email`, `location`, `travel_date`, `travelers`, `duration`, `tour_name`, `places`, `message`, `privacy_consent`, `privacy_consent_at`, CASE WHEN trim(`privacy_policy_version`) = '' OR `privacy_policy_version` = 'v1' THEN 'privacy-2026-08-04' ELSE `privacy_policy_version` END, `retention_until`, `anonymized_at`, `status`, `created_at`, `updated_at` FROM `inquiries`;--> statement-breakpoint
DROP TABLE `inquiries`;--> statement-breakpoint
ALTER TABLE `__new_inquiries` RENAME TO `inquiries`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_inquiries_tenant_status_created` ON `inquiries` (`tenant_id`,`status`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_inquiries_tenant_id_id` ON `inquiries` (`tenant_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_inquiries_tenant_submission` ON `inquiries` (`tenant_id`,`submission_id`);--> statement-breakpoint
CREATE INDEX `idx_inquiries_retention_pending` ON `inquiries` (`anonymized_at`,`retention_until`);--> statement-breakpoint
CREATE TABLE `__new_tenant_legal_pages` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`privacy_zh` text DEFAULT '' NOT NULL,
	`privacy_en` text DEFAULT '' NOT NULL,
	`terms_zh` text DEFAULT '' NOT NULL,
	`terms_en` text DEFAULT '' NOT NULL,
	`refund_zh` text DEFAULT '' NOT NULL,
	`refund_en` text DEFAULT '' NOT NULL,
	`policy_version` text DEFAULT 'privacy-2026-08-04' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
INSERT INTO `__new_tenant_legal_pages`(`id`, `tenant_id`, `privacy_zh`, `privacy_en`, `terms_zh`, `terms_en`, `refund_zh`, `refund_en`, `policy_version`, `created_at`, `updated_at`)
SELECT `id`, `tenant_id`, `privacy_zh`, `privacy_en`, `terms_zh`, `terms_en`, `refund_zh`, `refund_en`, CASE WHEN trim(`policy_version`) = '' OR `policy_version` = 'v1' THEN 'privacy-2026-08-04' ELSE `policy_version` END, `created_at`, `updated_at` FROM `tenant_legal_pages`;--> statement-breakpoint
DROP TABLE `tenant_legal_pages`;--> statement-breakpoint
ALTER TABLE `__new_tenant_legal_pages` RENAME TO `tenant_legal_pages`;--> statement-breakpoint
CREATE UNIQUE INDEX `uq_tenant_legal_pages_tenant` ON `tenant_legal_pages` (`tenant_id`);--> statement-breakpoint
