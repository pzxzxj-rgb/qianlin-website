-- Extend tenant_inquiry_sync_jobs.status CHECK constraint to allow 'dead_letter'.
-- SQLite cannot alter a CHECK constraint in place, so the table is rebuilt
-- following the same pattern used by 0011_small_triton.sql.
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_tenant_inquiry_sync_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`inquiry_id` integer NOT NULL,
	`provider` text DEFAULT 'disabled' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`external_record_id` text,
	`idempotency_key` text NOT NULL,
	`retry_count` integer DEFAULT 0 NOT NULL,
	`last_error_code` text,
	`last_error_message` text,
	`last_attempt_at` text,
	`synced_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`tenant_id`,`inquiry_id`) REFERENCES `inquiries`(`tenant_id`,`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "ck_tenant_inquiry_sync_jobs_provider" CHECK("__new_tenant_inquiry_sync_jobs"."provider" in ('disabled', 'mock', 'zhilv')),
	CONSTRAINT "ck_tenant_inquiry_sync_jobs_status" CHECK("__new_tenant_inquiry_sync_jobs"."status" in ('pending', 'processing', 'synced', 'failed', 'not_configured', 'dead_letter')),
	CONSTRAINT "ck_tenant_inquiry_sync_jobs_retry_count" CHECK("__new_tenant_inquiry_sync_jobs"."retry_count" >= 0 and "__new_tenant_inquiry_sync_jobs"."retry_count" <= 1000)
);
--> statement-breakpoint
INSERT INTO `__new_tenant_inquiry_sync_jobs`("id", "tenant_id", "inquiry_id", "provider", "status", "external_record_id", "idempotency_key", "retry_count", "last_error_code", "last_error_message", "last_attempt_at", "synced_at", "created_at", "updated_at") SELECT "id", "tenant_id", "inquiry_id", "provider", "status", "external_record_id", "idempotency_key", "retry_count", "last_error_code", "last_error_message", "last_attempt_at", "synced_at", "created_at", "updated_at" FROM `tenant_inquiry_sync_jobs`;--> statement-breakpoint
DROP TABLE `tenant_inquiry_sync_jobs`;--> statement-breakpoint
ALTER TABLE `__new_tenant_inquiry_sync_jobs` RENAME TO `tenant_inquiry_sync_jobs`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `uq_tenant_inquiry_sync_jobs_tenant_inquiry_provider` ON `tenant_inquiry_sync_jobs` (`tenant_id`,`inquiry_id`,`provider`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_tenant_inquiry_sync_jobs_idempotency_key` ON `tenant_inquiry_sync_jobs` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `idx_tenant_inquiry_sync_jobs_tenant_status` ON `tenant_inquiry_sync_jobs` (`tenant_id`,`status`,`updated_at`);--> statement-breakpoint
