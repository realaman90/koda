# Engineering Issues — UX Rollup

**Date:** 2026-02-21  
**Branch:** `feat/ux-preview-system-rollout`  
**Source:** `TECH-SPEC-UX-ROLLUP.md`

---

## Execution Order Summary

1. UXR-001 -> 2. UXR-002 -> 3. UXR-003 -> 4. UXR-004 -> 5. UXR-005 -> 6. UXR-006 -> 7. UXR-007 -> 8. UXR-008 -> 9. UXR-009 -> 10. UXR-010

P0 blockers: UXR-001..006

---

## UXR-001 — Extend Canvas Preview Metadata Contract

**Scope**
Introduce canonical thumbnail lifecycle fields in storage/domain types and metadata mapping.

**Likely files touched**
- `src/lib/storage/types.ts`
- `src/lib/storage/local-storage-provider.ts`
- `src/lib/storage/sqlite-provider.ts`
- `src/lib/db/schema.ts`

**Acceptance criteria**
- `StoredCanvas` and `CanvasMetadata` include new preview lifecycle fields.
- Backward compatibility with legacy `thumbnail` preserved.
- `canvasToMetadata` returns valid default `thumbnailStatus` when absent.

**Test checklist**
- [ ] Unit test for metadata mapping defaults
- [ ] Unit test for backward-compatible parse of legacy canvases
- [ ] Typecheck passes

**Dependencies**
- None (first issue)

---

## UXR-002 — Persist Preview Fields in Canvas API + SQLite CRUD

**Scope**
Wire new preview fields through API routes and SQLite provider CRUD paths.

**Likely files touched**
- `src/app/api/canvases/route.ts`
- `src/app/api/canvases/[id]/route.ts`
- `src/lib/storage/sqlite-provider.ts`
- `src/lib/db/schema.ts`
- `src/lib/db/migrate.ts` (or migration mechanism in use)

**Acceptance criteria**
- API accepts and returns new preview fields for create/update/get/list.
- SQLite rows persist and hydrate new fields correctly.
- Legacy rows are handled without runtime errors.

**Test checklist**
- [ ] API integration: POST/PUT/GET roundtrip includes preview metadata
- [ ] Migration test/backfill logic test
- [ ] Manual smoke: list canvases sorted and stable after update

**Dependencies**
- Depends on UXR-001

---

## UXR-003 — Build Preview Lifecycle Service (Client Queue + Debounce)

**Scope**
Implement client-side preview job orchestration: dirty marking, debounce, processing/error transitions.

**Likely files touched**
- `src/stores/app-store.ts`
- `src/stores/canvas-store.ts`
- `src/lib/export-utils.ts` (or new preview utility)
- `src/lib/assets/upload.ts`
- `src/lib/storage/sync-service.ts`

**Acceptance criteria**
- Preview jobs trigger on meaningful save checkpoints.
- Debounce window (`>=2s`) prevents repeated uploads during rapid edits.
- Status transitions handled: processing -> ready/error.
- Failure preserves previous valid preview URL.

**Test checklist**
- [ ] Unit test: debounce + last-write-wins behavior
- [ ] Integration test: upload failure path marks `error`
- [ ] Integration test: successful path updates `thumbnailUpdatedAt/version`

**Dependencies**
- Depends on UXR-001, UXR-002

---

## UXR-004 — Redesign CanvasCard State Rendering + Action Parity

**Scope**
Implement canonical card UI contract for preview states and interaction parity (mouse/keyboard/touch).

**Likely files touched**
- `src/components/dashboard/CanvasCard.tsx`
- `src/components/dashboard/ProjectsGrid.tsx`
- `src/components/common/GradientBorderCard.tsx` (deprecation/removal from card usage)
- `src/components/ui/*` (if shared menu/button primitives needed)

**Acceptance criteria**
- Card supports `ready/empty/stale/processing/error` visuals.
- Secondary menu reachable by keyboard and touch (not hover-only).
- Fixed 16:9 preview box prevents layout shifts.
- Generic controls align with blue baseline and no decorative gradients.

**Test checklist**
- [ ] Component tests for all five preview states
- [ ] Keyboard nav test for menu actions
- [ ] Mobile viewport test for action accessibility

**Dependencies**
- Depends on UXR-001, UXR-003

---

## UXR-005 — Add Manual “Refresh Preview” Action and Wiring

**Scope**
Expose explicit refresh action from card menu and connect to preview queue service.

**Likely files touched**
- `src/components/dashboard/CanvasCard.tsx`
- `src/components/dashboard/hooks/useDashboardState.ts`
- `src/stores/app-store.ts`

**Acceptance criteria**
- User can manually request preview refresh per canvas.
- UI reflects processing and completion/error states.
- Action works when status is stale/error/ready.

**Test checklist**
- [ ] Integration test for manual refresh state transitions
- [ ] E2E path: refresh updates timestamp/version

**Dependencies**
- Depends on UXR-003, UXR-004

---

## UXR-006 — Settings Tabs URL Sync (`/settings?tab=<id>`)

**Scope**
Make settings tab navigation URL-addressable and resilient to refresh/back navigation.

**Likely files touched**
- `src/components/settings/SettingsContent.tsx`
- `src/app/settings/page.tsx`

**Acceptance criteria**
- Active tab source-of-truth comes from query param.
- Invalid tab defaults to `api-keys`.
- Browser back/forward preserves tab transitions.

**Test checklist**
- [ ] Unit/component test for tab parsing/defaulting
- [ ] E2E test for reload/back behavior

**Dependencies**
- None (can run parallel to UXR-003/004 but required for P0)

---

## UXR-007 — Plugin Launcher Mode + IO Hints

**Scope**
Add plugin mode badges (`Node`/`Modal`) and optional input/output hint line in launcher rows.

**Likely files touched**
- `src/components/plugins/PluginLauncher/index.tsx`
- `src/lib/plugins/types.ts` (helper typing if needed)
- `src/lib/plugins/official/**/index.ts` (metadata normalization if needed)

**Acceptance criteria**
- Every plugin row displays launch mode before click.
- Rows remain visually clean and consistent with design system.
- No ambiguity between modal sandbox plugins and node-rendered plugins.

**Test checklist**
- [ ] Component test verifying mode label per plugin type
- [ ] Manual check with registered official plugins

**Dependencies**
- None hard; can follow UXR-004 styling pass

---

## UXR-008 — Dashboard Loading/Empty/Error State Quality Upgrade

**Scope**
Replace spinner-only project loading with skeleton/contextual placeholders and action-forward empty/error states.

**Likely files touched**
- `src/components/dashboard/ProjectsGrid.tsx`
- `src/components/dashboard/DashboardPage.tsx`
- `src/components/dashboard/CanvasCard.tsx`

**Acceptance criteria**
- Loading shows structural skeletons matching final grid.
- Empty state gives clear next-step CTA.
- Error state includes retry path where applicable.

**Test checklist**
- [ ] Visual regression snapshot for loading/empty/error
- [ ] Manual a11y copy/readability check

**Dependencies**
- Depends on UXR-004 for final card layout consistency

---

## UXR-009 — Preview Performance Guardrails (Lazy Load + Cache Busting)

**Scope**
Enforce preview performance constraints: lazy image loading, async decode, versioned URL cache control.

**Likely files touched**
- `src/components/dashboard/CanvasCard.tsx`
- `src/lib/storage/types.ts`
- `src/app/api/assets/[id]/route.ts` (verify caching headers)

**Acceptance criteria**
- Card images lazy-load and decode asynchronously.
- Version token prevents stale browser cache when preview updates.
- Dashboard first paint not blocked by preview refresh pipeline.

**Test checklist**
- [ ] Network verification: no eager loading of offscreen previews
- [ ] Manual check: updated thumbnail invalidates cache reliably
- [ ] Basic perf check with 100+ card list

**Dependencies**
- Depends on UXR-003, UXR-004

---

## UXR-010 — QA Hardening + Rollout Flag + Rollback Playbook

**Scope**
Feature-flag the preview system rollout and document/validate rollback path.

**Likely files touched**
- `src/stores/app-store.ts`
- `src/components/dashboard/CanvasCard.tsx`
- `docs/specs/TECH-SPEC-UX-ROLLUP.md` (rollout notes updates if needed)
- test specs / e2e configs

**Acceptance criteria**
- Feature flag can disable new preview UI/logic without breaking CRUD.
- Rollback procedure documented and verified once.
- P0 checklist complete and sign-off recorded.

**Test checklist**
- [ ] Flag ON/OFF smoke test
- [ ] Rollback simulation in staging
- [ ] Regression sweep: dashboard, canvas save, settings tabs, plugin launcher

**Dependencies**
- Depends on UXR-001..009

---

## Release Gate Checklist (P0)
- [ ] UXR-001 through UXR-006 complete
- [ ] Zero critical accessibility regressions on dashboard/settings
- [ ] Preview generation failures do not impact canvas save reliability
- [ ] Design compliance with `SPEC.md` (blue accent, no gradient/glow on core controls)
