CREATE TABLE `tenant_inquiry_sync_jobs` (
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
  FOREIGN KEY (`inquiry_id`) REFERENCES `inquiries`(`id`) ON UPDATE no action ON DELETE restrict,
  CONSTRAINT "ck_tenant_inquiry_sync_jobs_provider" CHECK("tenant_inquiry_sync_jobs"."provider" in ('disabled', 'mock', 'zhilv')),
  CONSTRAINT "ck_tenant_inquiry_sync_jobs_status" CHECK("tenant_inquiry_sync_jobs"."status" in ('pending', 'processing', 'synced', 'failed', 'not_configured')),
  CONSTRAINT "ck_tenant_inquiry_sync_jobs_retry_count" CHECK("tenant_inquiry_sync_jobs"."retry_count" >= 0 and "tenant_inquiry_sync_jobs"."retry_count" <= 1000)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_tenant_inquiry_sync_jobs_tenant_inquiry_provider` ON `tenant_inquiry_sync_jobs` (`tenant_id`, `inquiry_id`, `provider`);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_tenant_inquiry_sync_jobs_idempotency_key` ON `tenant_inquiry_sync_jobs` (`idempotency_key`);
--> statement-breakpoint
CREATE INDEX `idx_tenant_inquiry_sync_jobs_tenant_status` ON `tenant_inquiry_sync_jobs` (`tenant_id`, `status`, `updated_at`);
