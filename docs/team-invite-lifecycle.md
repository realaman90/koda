# Team Invites + Ownership Transfer (Issue #20)

## Invite lifecycle endpoints

- `POST /api/invites` — create invite (`pending`)
- `POST /api/invites/[token]` with `{ action: "accept" | "decline" | "revoke" }`
- `POST /api/invites/expire` — mark overdue pending invites as `expired`

## Status transitions

- `pending -> accepted`
- `pending -> declined`
- `pending -> revoked`
- `pending -> expired`

All transitions are persisted in `workspace_invites` with `accepted_at` / `revoked_at` / `updated_at`.

## Idempotency

- Accept flow uses `onConflictDoNothing` on `(workspace_id, user_id)` to guarantee a single membership row.
- Repeated accept on already-accepted invite returns `idempotent: true`.

## Ownership transfer

- `POST /api/workspaces/[workspaceId]/transfer-ownership`
- Atomic transaction:
  1. update `workspaces.owner_user_id`
  2. set target member role to `owner`
  3. demote previous owner to `admin`

## Canvas sharing metadata

- `canvas_shares` table stores per-canvas grants
- `POST /api/canvases/[id]/share` upserts share grant
- `DELETE /api/canvases/[id]/share` revokes share grant
