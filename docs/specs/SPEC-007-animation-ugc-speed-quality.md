# SPEC-007 — Animation Engine V2 (UGC Ads, Captioning, Speed + Quality)

**Status:** Draft  
**Date:** 2026-03-04  
**Owner:** Animation Platform  
**Related:** `src/app/api/plugins/animation/stream/route.ts`, `src/mastra/skills/animation/*`, `src/mastra/tools/animation/*`

---

## 1) Why This Spec Exists

We are in a crowded market. We need stronger ad outcomes with faster turnaround and higher consistency.

Current product gaps:
- UGC ad quality is inconsistent because character quality/consistency is weak.
- Auto-captioning is missing.
- A 10-second clip often takes >10 minutes in our current pipeline.
- Quality control exists, but it is not consistently enforced as a deterministic gate.
- We already have a Mastra skill framework, but most orchestration is still tool-driven and prompt-driven.

This spec defines an engineering-first path to fix those gaps.

---

## 2) Product Goals

## G1. Speed
- For a 10-second clip:
  - **Preview SLA:** p50 <= 4.5 minutes, p90 <= 6.5 minutes
  - **Final SLA (1080p):** p50 <= 6.5 minutes, p90 <= 8.5 minutes

## G2. UGC Quality
- First-pass quality pass rate >= 85% (internal quality rubric).
- Character consistency score >= 0.80 across scenes (face/style/wardrobe continuity checks).

## G3. Captions
- 100% of videos can be rendered with optional auto-captions.
- Caption timing drift <= 300ms for 95% of words.

## G4. Reliability
- Final render success rate >= 97%.
- Retry loops are bounded and predictable (no unbounded “wait and hope” behavior).

## G5. Dashboard Continuity
- Dashboard cards do not disappear on refresh while sync is in flight.
- Cached canvas metadata is shown immediately, then revalidated in background.

---

## 3) Non-Goals (V2)

- Full 3D avatar generation.
- Real-time lip-sync generation for arbitrary uploaded videos.
- Monthly model benchmarking platform.
- Full multilingual caption QA (English-first in V2).
- Replacing local cache with Redis-only cache for first paint UX.

---

## 4) Current-State Constraints (From Existing Code)

Observed in current implementation:
- Codegen can wait up to 60s when another codegen is active (`codeGenActive` wait loop).
- Render preflight can wait up to 60s for codegen completion.
- Remotion composition discovery can add up to ~30s per render call.
- Sandbox/media setup can add extra latency before useful generation begins.
- Quality verification exists (`verify_animation`), but gating and auto-repair are not normalized into a strict policy flow.
- Skill adapters are currently light (`recover`, `media_prepare`) while major orchestration remains LLM tool-calling behavior.
- Dashboard list uses a hard loading switch (`isLoadingList`) and has no dedicated last-good list snapshot cache, so slow sync can show empty/skeleton states even when recent data exists.

These patterns create unnecessary tail latency and variability.

---

## 5) Proposed Architecture

Introduce an explicit **Animation Profile Router** + deterministic **Skill-Orchestrated Pipeline**.

### 5.1 Pipeline (Target)
1. **Route profile** (ugc-testimonial, product-showcase, explainer, etc.)
2. **Build deterministic plan** from profile template + user prompt
3. **Prepare assets in parallel** (media, character pack, captions transcript)
4. **Generate code with constrained templates/examples**
5. **Fast preview render lane**
6. **Quality gate**
7. **Final render lane**
8. **Post-render quality gate + artifact report**

### 5.2 Design Principles
- Deterministic defaults before freeform generation.
- Fast path for previews, high-quality path for final.
- Parallelize I/O heavy prep.
- Bound retries and fail fast when a lane is unhealthy.

---

## 6) Workstream A — UGC Character System

## Scope
Ship a reusable character system tuned for ad use-cases.

## Deliverables
- `CharacterPackV1` schema:
  - `id`, `archetype`, `ageBand`, `styleTags`, `wardrobe`, `voicePreset`, `brandSafetyTags`
- Curated character packs for top UGC ad archetypes:
  - founder, customer testimonial, fitness coach, beauty creator, tech reviewer, parent lifestyle
- Character continuity constraints in generation:
  - stable face/style references, wardrobe lock, color lock
- Prompt + plan contract updates:
  - plan includes per-scene character presence + shot intent
- Quality checks:
  - consistency score, framing sanity, expression variety

## Expected impact
- Better ad realism and less generic output.
- Higher conversion quality for UGC-style scripts.

---

## 7) Workstream B — Auto-Captioning

## Scope
Add first-class caption generation and rendering.

## Deliverables
- Caption source priority:
  1. Existing script/transcript
  2. TTS text if generated in flow
  3. ASR fallback for uploaded/unknown audio
- New caption artifact model:
  - segment text, start/end times, confidence
- Caption styling presets:
  - `ugc-clean`, `ugc-bold`, `high-contrast-accessibility`
- Caption controls:
  - max chars per line, safe-area bounds, word highlight optional
- Render integration:
  - captions composited in preview and final render

## Expected impact
- Stronger ad watch-through and accessibility.
- Better “ready-to-publish” output quality.

---

## 8) Workstream C — Speed and Engine Simplification

## Scope
Cut latency with deterministic orchestration and cheaper preview path.

## Deliverables
- Replace polling waits with explicit orchestration locks:
  - remove long wait loops where possible
  - use queue semantics and immediate status results
- Cache and reuse:
  - composition ID cache per sandbox/session
  - warm sandbox pool with dependencies pre-installed
- Preview fast lane:
  - default 720p, lower render complexity, no heavy post effects
- Final lane:
  - 1080p/4k with full quality settings
- Template/example-led codegen:
  - profile-specific example snippets reduce rework and retries
- Instrumentation:
  - per-skill and per-stage latency (`intent`, `plan`, `codegen`, `render`, `verify`)

## Expected impact
- 35-55% latency reduction for common 10s workflows.

---

## 9) Workstream D — Quality Control as Policy

## Scope
Make QC deterministic and enforceable.

## Deliverables
- QC Gate 1 (pre-render static checks):
  - invalid easing, missing media refs, composition contract checks
- QC Gate 2 (preview visual checks):
  - screenshot/frame checks for motion existence, text visibility, layout sanity
- QC Gate 3 (final verification):
  - scorecard with pass/fail thresholds and targeted fix instructions
- Auto-repair policy:
  - max 1 repair loop for retryable quality failures
- Quality artifacts:
  - persist score, failed checks, fix path, final pass state

## Expected impact
- Higher first-pass usable output and less manual intervention.

---

## 10) Workstream E — Skill-Based Workflow Expansion (Mastra)

## Scope
Move from mostly prompt/tool orchestration to explicit skill-led orchestration per animation type.

## New skill roles (proposed)
- `profile_router`
- `character_director`
- `caption_builder`
- `render_budget_manager`
- `quality_gate`
- `iteration_controller`

## Existing skills retained
- `intent`, `plan`, `media_prepare`, `sandbox`, `codegen`, `verify`, `render`, `recover`

## Execution model
- Orchestrator selects profile + skill chain at run start.
- Each skill has:
  - strict input/output contract
  - bounded retry policy
  - metrics emission
- Tool calls become implementation details behind skill contracts.

## Expected impact
- Better predictability, easier debugging, less prompt fragility.

---

## 11) Workstream F — Dashboard Cache Layer (Local-First + SWR)

## Scope
Prevent project cards from disappearing during page refresh and slow sync.

## Strategy
- Keep **local cache as primary first-paint source** for per-user dashboard cards.
- Use **stale-while-revalidate**:
  1. Read last-good cached list instantly.
  2. Render cached cards immediately.
  3. Revalidate via existing sync/API in background.
  4. Merge and update cache.

## Why local before Upstash
- Problem is first-paint UX and client continuity; local cache solves this directly.
- Upstash/Redis helps backend query pressure and cross-instance caching, but does not replace instant client availability.
- Upstash can still be added later as a server-side optimization tier.

## Deliverables
- New persisted dashboard list cache key (metadata-only, compact payload).
- Cache freshness metadata (`cachedAt`, `source`, `stale`).
- Split list loading states:
  - `isBootLoading` (only when no cache exists)
  - `isRefreshing` (background revalidation while cards stay visible)
- Merge policy keeps last-good cards on transient sync failures.
- Recovery UX:
  - show “showing cached projects” notice when backend is slow/unavailable.

## Expected impact
- No blank dashboard during slow sync.
- Faster perceived load and better trust.

---

## 12) Data Model Changes (Proposed)

In `AnimationNodeState` and related API payloads:
- `profileId?: string`
- `characterPackId?: string`
- `characterManifest?: {...}`
- `captionState?: { enabled: boolean; preset: string; source: 'script'|'tts'|'asr'; confidence?: number }`
- `renderMetrics?: { planMs: number; codegenMs: number; previewRenderMs: number; finalRenderMs: number; totalMs: number }`
- `qualityReport?: { score: number; pass: boolean; checks: Record<string, { pass: boolean; note: string }> }`
- `dashboardCacheMeta?: { cachedAt: number; stale: boolean; source: 'local-cache' | 'live-sync' }`

---

## 13) Rollout Plan

## Phase 0 (Week 1): Instrument + Quick Wins
- Add end-to-end stage timing metrics and dashboard.
- Cache composition IDs.
- Reduce avoidable wait loops and tighten retry policy.
- Add dashboard metadata cache + SWR loading states.

## Phase 1 (Weeks 2-3): UGC Character V1 + Profile Router
- Ship profile router with 3 launch profiles.
- Add character packs and continuity constraints.

## Phase 2 (Weeks 4-5): Captions + Fast Preview Lane
- Caption generation and styling presets.
- Fast preview lane default with fallback to full preview.

## Phase 3 (Weeks 6-7): Deterministic QC + Auto-Repair
- Gate-based quality flow.
- One-pass auto-fix loop for retryable failures.

---

## 14) Acceptance Criteria

- 10s preview p50 <= 4.5m and p90 <= 6.5m for selected launch profiles.
- 10s final (1080p) p50 <= 6.5m and p90 <= 8.5m.
- First-pass quality pass rate >= 85%.
- Caption support available and stable across preview/final renders.
- Character consistency score >= 0.80 on UGC benchmark set.
- Dashboard retains visible project cards during slow sync refresh scenarios.

---

## 15) Risks and Mitigations

- Risk: More strict QC increases retries and can hurt latency.
  - Mitigation: fast prechecks + max one auto-repair loop.
- Risk: Character packs over-constrain creativity.
  - Mitigation: “strict” vs “flex” continuity modes.
- Risk: Caption timing quality varies with poor audio.
  - Mitigation: confidence scoring + fallback styling/pacing rules.
- Risk: Added skills increase operational complexity.
  - Mitigation: strict contracts + skill-level telemetry + staged rollout.
- Risk: Cached list can show stale project metadata.
  - Mitigation: explicit stale badge + background revalidate + merge on success.

---

## 16) Immediate Next Actions

1. Add stage-level timing metrics in stream + tools (P0 blocker).
2. Implement composition ID cache and remove repeated discovery calls where possible.
3. Introduce `profile_router` skill and 3 launch profiles.
4. Add `caption_builder` skill and caption state in node data contract.
5. Add QC gate policy with pass/fail thresholds and one auto-repair pass.
6. Add local dashboard cache + SWR list loading to stop refresh-time card disappearance.
