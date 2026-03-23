# Auth/Workspace Rollout Plan (Issue #22)

## Feature flags

- `AUTH_V1` — Clerk middleware + route protection
- `WORKSPACES_V1` — workspace bootstrap + scoped APIs
- `COLLAB_SHARING_V1` — invites, sharing metadata, ownership transfer APIs

All default to `true`; set to `false` to disable during phased rollout.

## Rollout phases

1. **Canary internal users**
   - `AUTH_V1=true`
   - `WORKSPACES_V1=false`
   - `COLLAB_SHARING_V1=false`
2. **Workspace activation**
   - `WORKSPACES_V1=true`
   - Run backfill: `npm run db:backfill:workspaces`
3. **Collaboration GA**
   - `COLLAB_SHARING_V1=true`
   - Monitor invite + ownership transfer audit entries

## Monitoring checks

- Audit log volume for: `invite.*`, `member.role_change`, `workspace.transfer_ownership`, `canvas.share`
- 4xx spikes on protected endpoints
- Backfill rerun should report zero additional updates
