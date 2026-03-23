# Workspace Collaboration Data Model (Issue #17)

## Tables

- `users` — identity source aligned to Clerk (`clerk_user_id` unique + indexed)
- `workspaces` — tenant boundary (`personal` or `team`) with `owner_user_id`
- `workspace_members` — role per workspace (`owner|admin|editor|viewer`), unique on `(workspace_id, user_id)`
- `workspace_invites` — invite lifecycle records with lookup index on `(workspace_id, email, status)`
- `projects` — workspace-scoped projects with owner reference
- `canvases` — now workspace-aware (`workspace_id`, `owner_user_id`, `project_id`)
- `audit_logs` — immutable security/compliance event stream by workspace

## Indexing highlights

- `users_clerk_user_id_unique`
- `workspace_members_workspace_user_unique`
- `idx_workspace_invites_workspace_email_status`
- `idx_canvases_workspace_updated`
- `idx_audit_logs_workspace_created`

## Notes

- Current schema keeps existing canvas JSON-blob storage for node/edge payloads.
- Foreign keys are intentionally deferred in this migration stage to avoid breakage during legacy backfill (#18).
