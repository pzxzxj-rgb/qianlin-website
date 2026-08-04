CREATE TABLE `inquiries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
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
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
