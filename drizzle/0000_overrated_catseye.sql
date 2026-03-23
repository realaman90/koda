CREATE TABLE `animation_projects` (
	`id` text PRIMARY KEY NOT NULL,
	`canvas_id` text,
	`engine` text,
	`plan` text,
	`active_version_id` text,
	`sandbox_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `animation_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`video_url` text,
	`snapshot_key` text,
	`thumbnail_url` text,
	`prompt` text,
	`duration` integer,
	`size_bytes` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`actor_user_id` text NOT NULL,
	`action` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`metadata` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_audit_logs_workspace_created` ON `audit_logs` (`workspace_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_audit_logs_actor` ON `audit_logs` (`actor_user_id`);--> statement-breakpoint
CREATE INDEX `idx_audit_logs_target` ON `audit_logs` (`target_type`,`target_id`);--> statement-breakpoint
CREATE INDEX `idx_audit_logs_action` ON `audit_logs` (`action`);--> statement-breakpoint
CREATE TABLE `canvases` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text,
	`owner_user_id` text,
	`project_id` text,
	`name` text NOT NULL,
	`nodes` text,
	`edges` text,
	`thumbnail` text,
	`thumbnail_url` text,
	`thumbnail_status` text DEFAULT 'empty' NOT NULL,
	`thumbnail_updated_at` integer,
	`thumbnail_version` text,
	`thumbnail_error_code` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_canvases_workspace` ON `canvases` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `idx_canvases_workspace_updated` ON `canvases` (`workspace_id`,`updated_at`);--> statement-breakpoint
CREATE INDEX `idx_canvases_owner` ON `canvases` (`owner_user_id`);--> statement-breakpoint
CREATE INDEX `idx_canvases_project` ON `canvases` (`project_id`);--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`owner_user_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_projects_workspace` ON `projects` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `idx_projects_owner` ON `projects` (`owner_user_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`clerk_user_id` text NOT NULL,
	`email` text NOT NULL,
	`first_name` text,
	`last_name` text,
	`image_url` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_clerk_user_id_unique` ON `users` (`clerk_user_id`);--> statement-breakpoint
CREATE INDEX `idx_users_clerk_user_id` ON `users` (`clerk_user_id`);--> statement-breakpoint
CREATE INDEX `idx_users_email` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `workspace_invites` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`email` text NOT NULL,
	`role` text DEFAULT 'viewer' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`token` text NOT NULL,
	`invited_by_user_id` text NOT NULL,
	`expires_at` integer,
	`accepted_at` integer,
	`revoked_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `workspace_invites_token_unique` ON `workspace_invites` (`token`);--> statement-breakpoint
CREATE INDEX `idx_workspace_invites_workspace_email_status` ON `workspace_invites` (`workspace_id`,`email`,`status`);--> statement-breakpoint
CREATE INDEX `idx_workspace_invites_workspace_status` ON `workspace_invites` (`workspace_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_workspace_invites_email_status` ON `workspace_invites` (`email`,`status`);--> statement-breakpoint
CREATE TABLE `workspace_members` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text DEFAULT 'viewer' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `workspace_members_workspace_user_unique` ON `workspace_members` (`workspace_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `idx_workspace_members_workspace_role` ON `workspace_members` (`workspace_id`,`role`);--> statement-breakpoint
CREATE INDEX `idx_workspace_members_user` ON `workspace_members` (`user_id`);--> statement-breakpoint
CREATE TABLE `workspaces` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text,
	`type` text DEFAULT 'personal' NOT NULL,
	`owner_user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `workspaces_slug_unique` ON `workspaces` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_workspaces_owner` ON `workspaces` (`owner_user_id`);--> statement-breakpoint
CREATE INDEX `idx_workspaces_type` ON `workspaces` (`type`);