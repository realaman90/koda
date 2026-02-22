CREATE TABLE `canvas_shares` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`canvas_id` text NOT NULL,
	`grantee_type` text DEFAULT 'user' NOT NULL,
	`grantee_id` text NOT NULL,
	`permission` text DEFAULT 'view' NOT NULL,
	`created_by_user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `canvas_shares_canvas_grantee_unique` ON `canvas_shares` (`canvas_id`,`grantee_type`,`grantee_id`);--> statement-breakpoint
CREATE INDEX `idx_canvas_shares_workspace` ON `canvas_shares` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `idx_canvas_shares_canvas` ON `canvas_shares` (`canvas_id`);