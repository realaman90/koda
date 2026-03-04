# Engineering Issues — SPEC-007 Animation V2

**Date:** 2026-03-04  
**Source:** `docs/specs/SPEC-007-animation-ugc-speed-quality.md`

---

## Execution Order Summary

1. ANV2-001 -> 2. ANV2-002 -> 3. ANV2-003 -> 4. ANV2-004 -> 5. ANV2-005 -> 6. ANV2-006 -> 7. ANV2-007 -> 8. ANV2-008

P0 blockers: ANV2-001, ANV2-002, ANV2-003

---

## ANV2-001 — Dashboard Local Cache + SWR List Loading (P0)

**Scope**
Stop dashboard cards from disappearing on refresh while sync/API is slow.

**Likely files touched**
- `src/stores/app-store.ts`
- `src/components/dashboard/hooks/useDashboardState.ts`
- `src/components/dashboard/ProjectsGrid.tsx`
- `src/lib/storage/local-storage-provider.ts`

**Acceptance criteria**
- Dashboard shows last-good cached project cards immediately on refresh.
- Background revalidation updates list without blanking cards.
- Loading state split:
  - hard loading only when cache miss
  - soft refreshing when cache hit + revalidate
- Transient sync/API errors do not clear visible cards.

**Test checklist**
- [ ] Unit test for cache read/write and stale marker logic
- [ ] Component test for cache-hit refresh behavior
- [ ] Manual test: throttle network + refresh dashboard

**Dependencies**
- None

---

## ANV2-002 — End-to-End Stage Timing Metrics (P0)

**Scope**
Instrument animation pipeline stage timings for plan/codegen/render/verify.

**Likely files touched**
- `src/app/api/plugins/animation/stream/route.ts`
- `src/mastra/skills/animation/metrics.ts`
- `src/lib/observability/launch-metrics.ts`

**Acceptance criteria**
- Every animation run emits stage durations and total elapsed time.
- Metrics can be segmented by engine (`remotion`/`theatre`) and profile.
- Failures include stage and error class for triage.

**Test checklist**
- [ ] Unit test for metrics payload shape
- [ ] Manual run verifies logs for success/failure flows

**Dependencies**
- None

---

## ANV2-003 — Render Path Latency Reduction (P0)

**Scope**
Reduce avoidable render latency via composition caching and simplified preflight.

**Likely files touched**
- `src/mastra/tools/animation/sandbox-tools.ts`
- `src/mastra/skills/animation/render-skill.ts`
- `src/app/api/plugins/animation/stream/route.ts`

**Acceptance criteria**
- Composition ID is cached per sandbox/session (no repeated discovery each render).
- Busy wait loops are reduced or replaced with bounded lock/queue behavior.
- 10s preview latency reduced measurably in benchmark runs.

**Test checklist**
- [ ] Benchmark script before/after for 10s clip
- [ ] Regression test for render success with cached composition ID

**Dependencies**
- Depends on ANV2-002

---

## ANV2-004 — Profile Router Skill

**Scope**
Add profile-based routing (ugc-testimonial, product-showcase, explainer) before plan/codegen.

**Likely files touched**
- `src/mastra/skills/animation/types.ts`
- `src/mastra/skills/animation/index.ts`
- `src/mastra/tools/animation/skill-tools.ts`
- `src/mastra/agents/animation-agent.ts`

**Acceptance criteria**
- Router assigns a profile deterministically with fallback behavior.
- Selected profile is persisted in node state and used by downstream skills.

**Test checklist**
- [ ] Unit tests for profile routing decisions
- [ ] Integration test for profile propagation into plan/codegen

**Dependencies**
- Depends on ANV2-002

---

## ANV2-005 — UGC Character Pack V1

**Scope**
Introduce reusable character packs and continuity constraints for UGC ads.

**Likely files touched**
- `src/lib/plugins/official/agents/animation-generator/types.ts`
- `src/mastra/tools/animation/generate-remotion-code-tool.ts`
- `public/assets/presets/characters/*` (or new character manifests)

**Acceptance criteria**
- Character pack can be selected and enforced through scenes.
- Character continuity metadata is included in plan and codegen context.

**Test checklist**
- [ ] Snapshot test for character metadata in context payload
- [ ] Manual QA on multi-scene continuity

**Dependencies**
- Depends on ANV2-004

---

## ANV2-006 — Caption Builder + Render Integration

**Scope**
Add auto-caption generation and burn-in support for preview/final outputs.

**Likely files touched**
- `src/mastra/skills/animation/*` (new caption skill)
- `src/mastra/tools/animation/generate-remotion-code-tool.ts`
- `src/lib/plugins/official/agents/animation-generator/types.ts`

**Acceptance criteria**
- Captions can be enabled per run.
- Caption source fallback works (script -> tts -> asr).
- Caption style presets render correctly in preview and final.

**Test checklist**
- [ ] Unit tests for caption segmentation/format payload
- [ ] Visual regression test for caption styles

**Dependencies**
- Depends on ANV2-004

---

## ANV2-007 — Quality Gate Policy + One-Pass Auto-Repair

**Scope**
Formalize pre-render, preview, and post-render quality gates with bounded repair.

**Likely files touched**
- `src/mastra/skills/animation/verify-skill.ts`
- `src/mastra/tools/animation/verify-animation-tool.ts`
- `src/app/api/plugins/animation/stream/route.ts`

**Acceptance criteria**
- Gate outputs structured pass/fail with thresholded score.
- Failed runs can auto-repair once when marked retryable.
- Quality artifacts are persisted in node state.

**Test checklist**
- [ ] Integration test for pass and fail+repair flows
- [ ] Regression test for no infinite retry loops

**Dependencies**
- Depends on ANV2-002, ANV2-003

---

## ANV2-008 — Local Cache vs Upstash Decision Gate

**Scope**
Make explicit cache architecture decision and add optional server-side cache tier if needed.

**Likely files touched**
- `docs/specs/SPEC-007-animation-ugc-speed-quality.md`
- (optional) `src/app/api/canvases/route.ts` if server-side caching is introduced later

**Acceptance criteria**
- Local-first cache is the required default for dashboard continuity.
- Upstash decision is documented as optional server optimization, not first-paint dependency.

**Test checklist**
- [ ] Architecture decision record reviewed by platform + product

**Dependencies**
- Depends on ANV2-001
