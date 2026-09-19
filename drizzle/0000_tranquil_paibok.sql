CREATE TABLE `consents` (
	`id` text PRIMARY KEY NOT NULL,
	`lead_id` text NOT NULL,
	`granted_at` integer NOT NULL,
	`withdrawn_at` integer,
	`version` text NOT NULL,
	`text_shown` text NOT NULL,
	`purpose` text NOT NULL,
	`channel` text NOT NULL,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `consents_lead_idx` ON `consents` (`lead_id`);--> statement-breakpoint
CREATE TABLE `leads` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text,
	`raw_address` text NOT NULL,
	`formatted_address` text,
	`latitude` real,
	`longitude` real,
	`state` text DEFAULT 'nuevo' NOT NULL,
	`state_reason` text,
	`channel` text DEFAULT 'web' NOT NULL,
	`campaign` text,
	`notes` text
);
--> statement-breakpoint
CREATE INDEX `leads_state_idx` ON `leads` (`state`);--> statement-breakpoint
CREATE INDEX `leads_created_idx` ON `leads` (`created_at`);--> statement-breakpoint
CREATE INDEX `leads_email_idx` ON `leads` (`email`);--> statement-breakpoint
CREATE TABLE `studies` (
	`id` text PRIMARY KEY NOT NULL,
	`lead_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`recommended_kwp` real NOT NULL,
	`annual_production_kwh` real NOT NULL,
	`investment_eur` real NOT NULL,
	`first_year_savings_eur` real NOT NULL,
	`payback_years` real,
	`confidence` text NOT NULL,
	`payload` text NOT NULL,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `studies_lead_idx` ON `studies` (`lead_id`);