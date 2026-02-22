# Legacy → Workspace Backfill Runbook (Issue #18)

## Commands

```bash
# 1) Preview only (no writes)
npm run db:backfill:workspaces -- --dry-run

# 2) Execute backfill
npm run db:backfill:workspaces

# 3) Regression/idempotency check on a seeded local dataset
npm run db:validate:backfill
```

## What the backfill does

1. Creates one personal workspace per existing user (`ws_personal_<userId>`)
2. Ensures owner membership exists for that personal workspace
3. Assigns legacy `projects` and `canvases` without `workspace_id` to the owner's personal workspace
4. Keeps reruns safe (idempotent updates + existence checks)

## Rollback approach

- Restore database backup/snapshot taken before running step (2).
- Because operations are deterministic and idempotent, rerunning after restore is safe.

## Verification checklist

- No `projects.workspace_id IS NULL`
- No `canvases.workspace_id IS NULL`
- Every `workspaces.type='personal'` has exactly one owner member for the workspace owner
- Second run of backfill produces zero new creations/mutations
