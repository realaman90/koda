# TECH SPEC — UX Rollup (Dashboard Preview + Interaction Consistency)

**Date:** 2026-02-21  
**Branch:** `feat/ux-preview-system-rollout`  
**Inputs:**
- `docs/specs/UX-UI-DEEP-AUDIT-2026-02-21.md`
- `docs/specs/UX-UI-IMPROVEMENT-PROPOSAL.md`
- `docs/specs/SPEC.md`

---

## 1) Scope and Intent

This spec converts the UX proposal into implementation architecture for **P0/P1 UX rollout**, with P0 focused on:
1. Trustworthy dashboard previews (real canvas thumbnails + explicit state model)
2. Canonical card interaction contract (mouse/keyboard/touch parity)
3. URL-synced settings tabs
4. Plugin launcher predictability (Node/Modal affordance)

Design constraints from unified system SPEC:
- Blue interactive baseline `#3b82f6`
- No decorative gradients/glows on generic controls/cards
- Shared interaction behavior across Dashboard/Canvas/Settings/Plugins

---

## 2) Architecture Decisions

## AD-01: Introduce explicit thumbnail lifecycle metadata (not just `thumbnail` string)

### Decision
Extend canvas metadata model to track preview lifecycle as first-class state.

### New fields (canonical)
- `thumbnailUrl?: string`
- `thumbnailStatus: 'ready' | 'empty' | 'stale' | 'processing' | 'error'`
- `thumbnailUpdatedAt?: number`
- `thumbnailVersion?: string` (cache bust token)
- `thumbnailErrorCode?: 'UPLOAD_FAILED' | 'CAPTURE_FAILED' | 'UNSUPPORTED' | 'UNKNOWN'`

### Why
Current model has only optional `thumbnail`, which cannot represent state transitions or reliability.

---

## AD-02: Client-side capture + server asset storage for preview image persistence

### Decision
Generate snapshots client-side from canvas viewport, upload via existing `/api/assets/upload`, persist returned URL into canvas metadata.

### Why
- Reuses existing asset infrastructure (`/api/assets/upload`, local/R2/S3 providers)
- Avoids server-side ReactFlow rendering complexity
- Keeps preview generation closest to user edits

### Notes
- Capture should be from a stable viewport frame (post-save debounce)
- Preview image target: JPEG/WebP, max width 640 (16:9), quality tuned for dashboard cards

---

## AD-03: Preview orchestration runs as a debounced, cancelable client job queue

### Decision
Add a preview lifecycle service in client state layer to schedule/cancel refresh jobs:
- Trigger on meaningful canvas changes + save
- 2s inactivity debounce window
- Last-write-wins for rapid edits

### Why
Prevents churn and avoids blocking save path.

---

## AD-04: Local-first save path remains; preview update is asynchronous side effect

### Decision
Do not gate canvas save on preview success.
- Canvas content save succeeds independently
- Preview status updates independently (`processing` -> `ready` / `error`)

### Why
Reliability: users should never lose canvas saves due to preview pipeline issues.

---

## AD-05: Keep list payload lightweight; no inline base64 in dashboard metadata

### Decision
Only store URL + status metadata in `CanvasMetadata`.

### Why
- Prevent localStorage quota pressure
- Keep list rendering and sync fast
- Leverage immutable asset caching

---

## AD-06: Standardized CanvasCard state contract across input modes

### Decision
Card interaction contract:
- Primary target: open canvas
- Secondary menu: always reachable (not hover-only)
- Keyboard focus-visible actions and touch-safe hit areas

### Why
Fixes accessibility and mobile parity gaps called out in audit.

---

## 3) Data Model and Contract Updates

## 3.1 Storage/domain types

### Files impacted
- `src/lib/storage/types.ts`
- `src/lib/storage/local-storage-provider.ts`
- `src/lib/storage/sqlite-provider.ts`
- `src/lib/db/schema.ts`
- `src/app/api/canvases/route.ts`
- `src/app/api/canvases/[id]/route.ts`

### Proposed type changes

```ts
// storage/types.ts
export type ThumbnailStatus = 'ready' | 'empty' | 'stale' | 'processing' | 'error';

export interface StoredCanvas {
  id: string;
  name: string;
  nodes: AppNode[];
  edges: AppEdge[];

  // legacy (read-only compatibility during migration)
  thumbnail?: string;

  // new canonical preview metadata
  thumbnailUrl?: string;
  thumbnailStatus?: ThumbnailStatus; // default 'empty'
  thumbnailUpdatedAt?: number;
  thumbnailVersion?: string;
  thumbnailErrorCode?: string;

  createdAt: number;
  updatedAt: number;
}

export interface CanvasMetadata {
  id: string;
  name: string;

  thumbnailUrl?: string;
  thumbnailStatus: ThumbnailStatus;
  thumbnailUpdatedAt?: number;
  thumbnailVersion?: string;

  createdAt: number;
  updatedAt: number;
  nodeCount: number;
}
```

### DB schema changes (`canvases` table)
Add columns:
- `thumbnail_url TEXT`
- `thumbnail_status TEXT NOT NULL DEFAULT 'empty'`
- `thumbnail_updated_at INTEGER`
- `thumbnail_version TEXT`
- `thumbnail_error_code TEXT`

Migration requirement:
- Backfill from legacy `thumbnail` -> `thumbnail_url`, set status `ready`
- Existing rows without thumbnail become `empty`

---

## 3.2 Component contracts

### `CanvasCard` props (dashboard)
Current: expects `CanvasMetadata` with `thumbnail?`  
New: read `thumbnailUrl + thumbnailStatus` and render explicit visual state:
- `ready`: image
- `empty`: neutral empty state
- `processing`: skeleton + “Updating preview…”
- `stale`: image + stale badge + refresh action
- `error`: fallback + retry action

### `ProjectsGrid`
Replace spinner-only loading with card skeletons preserving layout density.

### `PluginLauncher`
Row metadata must include mode badge (`Node` / `Modal`) using `plugin.rendering?.mode` fallbacking to `modal` when `sandbox` exists and no rendering mode provided.

### `SettingsContent`
Tab source of truth from URL query `?tab=<id>`.

---

## 4) Data Flow — Preview Generation / Storage / Refresh

## 4.1 Generation flow (automatic)
1. User edits canvas; autosave persists nodes/edges.
2. “Meaningful change detector” marks preview dirty.
3. After save + 2s inactivity, enqueue preview job.
4. Set `thumbnailStatus = 'processing'` locally.
5. Capture canvas frame (client) -> compress to image blob.
6. Upload blob to `/api/assets/upload` with `canvasId` metadata.
7. Receive `{ url }`, compute new `thumbnailVersion` token.
8. Persist canvas metadata (`thumbnailUrl`, `thumbnailStatus='ready'`, `thumbnailUpdatedAt=now`, `thumbnailVersion`).
9. If SQLite sync enabled, standard sync service propagates metadata server-side.

## 4.2 Manual refresh flow
1. User triggers “Refresh preview” from card menu.
2. Force enqueue job regardless of stale detector.
3. Same pipeline as automatic.

## 4.3 Stale detection flow
A preview is stale when either condition is true:
- `updatedAt > thumbnailUpdatedAt`
- node graph hash/version differs from `thumbnailVersion`

If stale and generation not active:
- Render stale badge
- Keep existing preview visible
- Offer manual refresh

## 4.4 Error flow
If capture/upload fails:
- Keep last good `thumbnailUrl` if present
- Set `thumbnailStatus='error'` + `thumbnailErrorCode`
- Expose retry action from card menu and inline state surface

---

## 5) Fallback State Logic

## State matrix

### `empty`
Condition:
- Canvas has no preview-eligible visual output
UI:
- Neutral placeholder illustration/icon
- Label: “No preview yet”

### `processing`
Condition:
- Preview job queued/running
UI:
- Skeleton overlay in fixed 16:9 area
- Label: “Updating preview…”

### `stale`
Condition:
- Existing preview but older than meaningful canvas state
UI:
- Show existing image + subtle stale badge + refresh affordance

### `error`
Condition:
- Last attempt failed
UI:
- Last good image if available; otherwise neutral fallback
- Retry action

### `ready`
Condition:
- Latest preview captured and persisted
UI:
- Render preview image

---

## 6) Performance Constraints and Budgets

## Dashboard rendering
- Preview area fixed 16:9 to avoid CLS
- Lazy-load preview images with intersection observer (`rootMargin` prefetch)
- Use `loading="lazy"`, `decoding="async"`
- Do not block initial dashboard render on preview generation

## Asset constraints
- Target preview payload: <= 120KB median, <= 250KB p95
- Dimensions: 640x360 (or 768x432 max) for dashboard usage
- Prefer JPEG/WebP depending on browser support

## Refresh constraints
- Debounce generation: 2000ms inactivity
- Max one in-flight preview job per canvas ID
- Backoff retry for transient errors (e.g., 1s, 3s, 10s; max 3 attempts)

## Cache strategy
- Immutable asset URLs or version query token for busting
- If URL unchanged, append `?v=<thumbnailVersion>`
- Serve with long cache headers (already supported in local assets route)

---

## 7) API and Store Changes

## 7.1 API surface

### Extend existing canvas PUT/POST payloads
Accept and persist:
- `thumbnailUrl`
- `thumbnailStatus`
- `thumbnailUpdatedAt`
- `thumbnailVersion`
- `thumbnailErrorCode`

### Optional endpoint (recommended)
`POST /api/canvases/:id/thumbnail`
- Purpose: update thumbnail metadata atomically, reduce accidental overwrite risks in full canvas PUT
- Body: preview metadata only

(If not introduced, existing PUT endpoint must support safe partial metadata updates.)

## 7.2 Store changes

### `app-store`
- Add action: `updateCanvasThumbnail(id, patch)`
- Add selector helpers for stale state calculation in list

### `canvas-store`
- No core graph schema changes required
- Add “preview dirty marker” helper from meaningful events

### `sync-service`
- Ensure metadata-only updates sync without requiring full node/edge diff churn

---

## 8) UX Contract Updates by Surface

## Dashboard
- Remove decorative card treatment (`GradientBorderCard`) from canvas cards
- Keep action emphasis with blue baseline and neutral surfaces
- Secondary menu always visible on touch/focus, not hover-only

## Settings
- URL-synced tabs via query params (`/settings?tab=api-keys`)
- Back/forward and refresh preserve active tab

## Plugin launcher
- Add mode chip (`Node`/`Modal`) + optional IO hint line
- Users can predict launch behavior pre-click

---

## 9) Testing Strategy

## Unit tests
- Thumbnail state reducer/transitions
- Stale detector logic
- Metadata mapping (`StoredCanvas` <-> `CanvasMetadata`)

## Integration tests
- Save canvas -> preview job queued -> metadata updated
- Upload fail path sets `error` and preserves previous preview
- SQLite sync retains new fields and ordering

## E2E (Playwright/Cypress)
- Create canvas with visual nodes -> dashboard shows real preview
- Manual refresh updates preview timestamp/version
- Settings tab deep-link persists across reload/back
- Card actions accessible via keyboard and touch emulation
- Plugin launcher shows mode badges for all registered plugins

## Accessibility checks
- All icon-only buttons have accessible names
- Focus-visible rings present and consistent
- No critical hover-only actions

---

## 10) Rollout Plan and Rollback

## Rollout (feature-flagged)
Flag: `NEXT_PUBLIC_UX_PREVIEW_SYSTEM_V1`

### Phase 1 (dark launch)
- Ship schema + type support + metadata writes
- Keep old rendering fallback path

### Phase 2 (read path switch)
- Enable new CanvasCard state rendering
- Enable preview generation queue for a subset/internal users

### Phase 3 (full enable)
- Remove legacy emoji-only fallback from happy path
- Enable plugin mode badges + settings URL sync globally

## Rollback strategy
- Disable flag to return to legacy card rendering
- Keep DB columns (non-breaking additive migration)
- If preview pipeline instability occurs, set status to `empty/error` while preserving core canvas CRUD

Operational rollback invariant:
- Canvas editing/saving must remain unaffected regardless of preview subsystem status.

### Implementation switch (current)
- `NEXT_PUBLIC_UX_PREVIEW_SYSTEM_V1=true` (default behavior) enables preview lifecycle state rendering + background preview refresh queue.
- `NEXT_PUBLIC_UX_PREVIEW_SYSTEM_V1=false` disables preview lifecycle queue and falls back to legacy thumbnail-only card rendering.

### Rollback Playbook (validated)
1. Set `NEXT_PUBLIC_UX_PREVIEW_SYSTEM_V1=false` in the active environment.
2. Redeploy app (or restart dev server) so client bundles pick up the flag.
3. Smoke test critical flows:
   - Dashboard cards still render from legacy `thumbnail`/`thumbnailUrl` data.
   - Canvas CRUD (create, rename, duplicate, delete, save) remains functional.
   - No preview refresh jobs are triggered from autosave path.
4. Keep additive DB fields in place (`thumbnail_*` columns); no schema rollback required.
5. Re-enable by setting `NEXT_PUBLIC_UX_PREVIEW_SYSTEM_V1=true` when stability is confirmed.

### P0 Rollout Checklist + Sign-off
- [x] Flag ON/OFF smoke test coverage added (preview state fallback test).
- [x] Rollback path documented and validated in code path (`CanvasCard` + `app-store` gate).
- [x] Regression focus retained for dashboard + save path (preview async side-effect remains non-blocking).

**Sign-off:** 2026-02-22 — UX preview rollout can be safely disabled via flag without impacting core canvas CRUD.

---

## 11) Open Questions / Decisions Needed
1. Preview capture source: full viewport vs fitted bounds of top-level visual nodes (recommend fitted bounds for relevance).
2. Preview generation trigger strictness: on every meaningful edit vs on explicit save checkpoints only (recommend save checkpoint + debounce).
3. Metadata-only endpoint adoption (`POST /thumbnail`) vs extending existing PUT semantics.
4. Whether to add “pinned/recently opened” in same rollout or defer to P2.

---

## 12) Definition of Done (P0)
- Dashboard cards show real previews for canvases with visual outputs.
- Card state taxonomy implemented (`ready/empty/stale/processing/error`).
- Critical card actions available without hover dependency.
- Settings tabs URL-synced and refresh/back safe.
- Plugin launcher exposes mode before launch.
- No gradient/glow regressions on updated surfaces.
