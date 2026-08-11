CREATE TABLE IF NOT EXISTS `_migration_0011_sync_job_guard` (
	`mismatch_count` integer NOT NULL CHECK(`mismatch_count` = 0)
);--> statement-breakpoint
DELETE FROM `_migration_0011_sync_job_guard`;--> statement-breakpoint
INSERT INTO `_migration_0011_sync_job_guard`(`mismatch_count`)
SELECT COUNT(*)
FROM `tenant_inquiry_sync_jobs` AS jobs
LEFT JOIN `inquiries` AS inquiries ON inquiries.`id` = jobs.`inquiry_id`
WHERE inquiries.`id` IS NULL OR inquiries.`tenant_id` <> jobs.`tenant_id`;--> statement-breakpoint
DROP TABLE `_migration_0011_sync_job_guard`;--> statement-breakpoint
CREATE UNIQUE INDEX `uq_inquiries_tenant_id_id` ON `inquiries` (`tenant_id`,`id`);--> statement-breakpoint
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
	CONSTRAINT "ck_tenant_inquiry_sync_jobs_status" CHECK("__new_tenant_inquiry_sync_jobs"."status" in ('pending', 'processing', 'synced', 'failed', 'not_configured')),
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
CREATE TABLE `__new_admin_audit_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenant_id` text NOT NULL,
	`user_id` text,
	`action` text NOT NULL,
	`resource_type` text NOT NULL,
	`resource_id` text,
	`result` text DEFAULT 'success' NOT NULL,
	`metadata` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "ck_admin_audit_logs_result" CHECK("__new_admin_audit_logs"."result" in ('success', 'failure'))
);
--> statement-breakpoint
INSERT INTO `__new_admin_audit_logs`("id", "tenant_id", "user_id", "action", "resource_type", "resource_id", "result", "metadata", "created_at") SELECT "id", "tenant_id", "user_id", "action", "resource_type", "resource_id", "result", "metadata", "created_at" FROM `admin_audit_logs`;--> statement-breakpoint
DROP TABLE `admin_audit_logs`;--> statement-breakpoint
ALTER TABLE `__new_admin_audit_logs` RENAME TO `admin_audit_logs`;--> statement-breakpoint
CREATE INDEX `idx_admin_audit_logs_tenant_created` ON `admin_audit_logs` (`tenant_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_admin_audit_logs_user_created` ON `admin_audit_logs` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_inquiries_retention_pending` ON `inquiries` (`anonymized_at`,`retention_until`);
