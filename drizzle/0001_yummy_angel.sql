PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_projects` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text,
	`owner_user_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_projects`("id", "workspace_id", "owner_user_id", "name", "description", "created_at", "updated_at") SELECT "id", "workspace_id", "owner_user_id", "name", "description", "created_at", "updated_at" FROM `projects`;--> statement-breakpoint
DROP TABLE `projects`;--> statement-breakpoint
ALTER TABLE `__new_projects` RENAME TO `projects`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_projects_workspace` ON `projects` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `idx_projects_owner` ON `projects` (`owner_user_id`);