ALTER TABLE `tenant_site_profiles` ADD `og_image_url` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `inquiries` ADD `privacy_consent_at` text;
--> statement-breakpoint
ALTER TABLE `inquiries` ADD `privacy_policy_version` text DEFAULT 'v1' NOT NULL;
--> statement-breakpoint
ALTER TABLE `inquiries` ADD `retention_until` text;
--> statement-breakpoint
ALTER TABLE `inquiries` ADD `anonymized_at` text;
--> statement-breakpoint
ALTER TABLE `inquiries` ADD `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL;
--> statement-breakpoint
CREATE TABLE `users` (
  `id` text PRIMARY KEY NOT NULL,
  `username` text NOT NULL,
  `password_hash` text NOT NULL,
  `display_name_zh` text DEFAULT '' NOT NULL,
  `display_name_en` text DEFAULT '' NOT NULL,
  `status` text DEFAULT 'active' NOT NULL,
  `last_login_at` text,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT "ck_users_status" CHECK("users"."status" in ('active', 'suspended', 'disabled'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_users_username` ON `users` (`username`);
--> statement-breakpoint
CREATE INDEX `idx_users_status` ON `users` (`status`);
--> statement-breakpoint
CREATE TABLE `tenant_memberships` (
  `id` text PRIMARY KEY NOT NULL,
  `tenant_id` text NOT NULL,
  `user_id` text NOT NULL,
  `role` text DEFAULT 'viewer' NOT NULL,
  `status` text DEFAULT 'active' NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE restrict,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
  CONSTRAINT "ck_tenant_memberships_role" CHECK("tenant_memberships"."role" in ('owner', 'admin', 'editor', 'viewer')),
  CONSTRAINT "ck_tenant_memberships_status" CHECK("tenant_memberships"."status" in ('active', 'suspended', 'revoked'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_tenant_memberships_tenant_user` ON `tenant_memberships` (`tenant_id`, `user_id`);
--> statement-breakpoint
CREATE INDEX `idx_tenant_memberships_tenant_status` ON `tenant_memberships` (`tenant_id`, `status`);
--> statement-breakpoint
CREATE TABLE `sessions` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `token_hash` text NOT NULL,
  `expires_at` integer NOT NULL,
  `revoked_at` integer,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `last_used_at` text,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_sessions_token_hash` ON `sessions` (`token_hash`);
--> statement-breakpoint
CREATE INDEX `idx_sessions_user_expiry` ON `sessions` (`user_id`, `expires_at`);
--> statement-breakpoint
CREATE TABLE `admin_audit_logs` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `tenant_id` text NOT NULL,
  `user_id` text NOT NULL,
  `action` text NOT NULL,
  `resource_type` text NOT NULL,
  `resource_id` text,
  `result` text DEFAULT 'success' NOT NULL,
  `metadata` text DEFAULT '' NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE restrict,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
  CONSTRAINT "ck_admin_audit_logs_result" CHECK("admin_audit_logs"."result" in ('success', 'failure'))
);
--> statement-breakpoint
CREATE INDEX `idx_admin_audit_logs_tenant_created` ON `admin_audit_logs` (`tenant_id`, `created_at`);
--> statement-breakpoint
CREATE INDEX `idx_admin_audit_logs_user_created` ON `admin_audit_logs` (`user_id`, `created_at`);
--> statement-breakpoint
CREATE TABLE `tenant_legal_pages` (
  `id` text PRIMARY KEY NOT NULL,
  `tenant_id` text NOT NULL,
  `privacy_zh` text DEFAULT '' NOT NULL,
  `privacy_en` text DEFAULT '' NOT NULL,
  `terms_zh` text DEFAULT '' NOT NULL,
  `terms_en` text DEFAULT '' NOT NULL,
  `refund_zh` text DEFAULT '' NOT NULL,
  `refund_en` text DEFAULT '' NOT NULL,
  `policy_version` text DEFAULT 'v1' NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_tenant_legal_pages_tenant` ON `tenant_legal_pages` (`tenant_id`);
--> statement-breakpoint
CREATE TABLE `tenant_quotas` (
  `tenant_id` text PRIMARY KEY NOT NULL,
  `inquiry_limit` integer DEFAULT 1000 NOT NULL,
  `admin_limit` integer DEFAULT 10 NOT NULL,
  `image_limit` integer DEFAULT 100 NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE restrict,
  CONSTRAINT "ck_tenant_quotas_limits" CHECK("tenant_quotas"."inquiry_limit" > 0 and "tenant_quotas"."admin_limit" > 0 and "tenant_quotas"."image_limit" > 0)
);
--> statement-breakpoint
INSERT OR IGNORE INTO `tenant_legal_pages` (`id`, `tenant_id`, `privacy_zh`, `privacy_en`, `terms_zh`, `terms_en`, `refund_zh`, `refund_en`, `policy_version`) VALUES
  ('qianlin-legal', 'qianlin-travel', '黔林旅行社隐私政策\n我们仅在提供旅行咨询、行程规划和客户服务所需范围内处理联系信息。', 'Qianlin Travel Privacy Policy\nWe process contact information only as needed to provide travel enquiries, planning, and customer service.', '黔林旅行社服务条款\n网站内容用于旅行咨询和规划，具体服务以双方确认的书面安排为准。', 'Qianlin Travel Terms of Service\nWebsite content supports travel enquiries and planning; confirmed written arrangements govern any service.', '黔林旅行社退款政策\n退款和取消规则以具体产品或书面服务安排中的约定为准。', 'Qianlin Travel Refund Policy\nRefund and cancellation terms are governed by the specific product or written service arrangement.', 'v1'),
  ('yunnan-demo-legal', 'yunnan-demo', '云南旅行社演示站隐私政策\n本页面仅用于演示，不接收真实咨询。', 'Yunnan Demo Travel Privacy Policy\nThis demo site does not accept real enquiries.', '云南旅行社演示站服务条款\n本页面仅用于演示网站结构和租户隔离。', 'Yunnan Demo Travel Terms of Service\nThis demo site is for demonstrating site structure and tenant isolation.', '云南旅行社演示站退款政策\n演示站不提供可购买服务。', 'Yunnan Demo Travel Refund Policy\nThe demo site does not provide purchasable services.', 'v1');
--> statement-breakpoint
INSERT OR IGNORE INTO `tenant_quotas` (`tenant_id`, `inquiry_limit`, `admin_limit`, `image_limit`) VALUES
  ('qianlin-travel', 1000, 10, 100),
  ('yunnan-demo', 1000, 10, 100);
