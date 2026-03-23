# RESEARCH: Animation Plugin Pipeline, Model Strategy, and SVG-First Augmentation

**Date:** 2026-02-22  
**Author:** Lead engineering research pass  
**Scope:** Research/spec only (no production behavior changes)

---

## 1) Executive Summary

The current animation plugin architecture is already well-structured for multi-model experimentation:

- A **single orchestrator agent** drives plan/execute/verify with strong server-side controls.
- Code generation is already split into **engine-specific subagents**:
  - Remotion code generator (`generate_remotion_code`)
  - Theatre.js code generator (`generate_code`)
- Most critical reliability controls are server-enforced (plan gate, sandbox ID resolution, tool serialization, render wait-for-codegen).

### Key findings

1. **Current model baseline is already Gemini-heavy**, not legacy-only:
   - Orchestrator: `google/gemini-3-flash-preview`
   - Codegen (Remotion + Theatre): `google/gemini-3-flash-preview`
   - Prompt enhancer: `google/gemini-3-pro-preview`
2. Replacing generation/planning with **Gemini 3.1 Pro preview** is technically low-effort (central constants), but carries preview-model volatility (latency/quotas/cost/reliability drift).
3. **SVG-first is feasible** as an augmentation path, but there are concrete integration gaps:
   - `stream/route.ts` media extension inference does **not include `.svg`** in key paths.
   - MIME/extension normalization may incorrectly coerce SVG uploads to `.png` fallback in some flows.
4. Recommended near-term strategy:
   - **Option C (hybrid)** as default recommendation:
     - planner/complex revisions on Gemini 3.1 Pro preview
     - high-throughput generation/render loops remain on Gemini 3 Flash preview
   - Add **Option D (SVG-first augmentation)** as a targeted mode for logo/brand/vector-heavy prompts.

---

## 2) Current Pipeline: Architecture + Prompt/Instruction Flow

## 2.1 Frontend node and stream entry

Primary UI node:
- `src/lib/plugins/official/agents/animation-generator/AnimationNode.tsx`

Primary stream hook:
- `src/lib/plugins/official/agents/animation-generator/hooks/useAnimationStream.ts`

Frontend sends to:
- `POST /api/plugins/animation/stream`
- File: `src/app/api/plugins/animation/stream/route.ts`

### Context carried per stream

The node/hook pass rich context each turn:
- `phase`, `plan`, `todos`, `sandboxId`
- `engine` (`remotion` or `theatre`)
- `aspectRatio`, `duration`, `fps`, `resolution`
- `designSpec`, `techniques`
- `media` (upload + edge media)

This context continuity is a major quality enabler, especially for iterative edits.

---

## 2.2 Orchestrator and tool graph

Orchestrator registration:
- `src/mastra/agents/animation-agent.ts`

System instructions (base + engine addendum):
- `src/mastra/agents/instructions/animation.ts`

Tool exports:
- `src/mastra/tools/animation/index.ts`

### Core orchestration phases (effective behavior)

1. Analyze/enhance prompt
2. Generate plan (`generate_plan`)
3. **Hard plan gate** (server enforces no execution tool calls in same stream after plan)
4. Sandbox create/reuse
5. Code generation via subagent tool
6. Render (`render_final`)
7. Optional verify (`verify_animation`) only when needed

---

## 2.3 Server-side controls and reliability constraints

File: `src/app/api/plugins/animation/stream/route.ts`

Important guardrails:

- **Plan approval enforcement at code level** (not instruction-only): execution tools are blocked after `generate_plan` until approval turn.
- **RequestContext** carries trusted `sandboxId`, `engine`, `designSpec`, `mediaFiles`, `pendingMedia`, etc. Tools prefer this over model args.
- **Dead sandbox detection** + snapshot restore guidance.
- **Media preprocessing server-side** (base64/url/local asset decode, upload, pending queue).
- **Stream budgets:** `maxDuration=120`, `bodySizeLimit=50mb`, message windowing (`MAX_MESSAGES=10`), step caps (`maxSteps=12` planning / `75` execution).

These controls reduce prompt/tool drift and make model swaps safer.

---

## 2.4 Model call map (actual code)

Central model constants:
- `src/mastra/models.ts`

Current values:
- `ORCHESTRATOR_MODEL = google/gemini-3-flash-preview`
- `REMOTION_CODE_GEN_MODEL = google/gemini-3-flash-preview`
- `THEATRE_CODE_GEN_MODEL = google/gemini-3-flash-preview`
- `IMAGE_ANALYZER_MODEL = google/gemini-3-flash-preview`
- `VIDEO_ANALYZER_MODEL = google/gemini-3-flash-preview`
- `ANIMATION_PROMPT_ENHANCER_MODEL = google/gemini-3-pro-preview`

Codegen subagents:
- Remotion: `src/mastra/agents/remotion-code-generator-agent.ts`
- Theatre: `src/mastra/agents/code-generator-agent.ts`

Media analysis and verification:
- `src/mastra/tools/animation/analyze-media-tool.ts`
- `src/mastra/tools/animation/verify-animation-tool.ts`

---

## 2.5 Remotion/Theatre.js split

Engine-specific behavior is instruction-gated + tool-gated:
- Remotion codegen: `generate_remotion_code`
- Theatre codegen: `generate_code`

Sandbox rendering:
- `src/mastra/tools/animation/sandbox-tools.ts`
  - Remotion path: `bunx remotion render ...`
  - Theatre path: `node export-video.cjs ...` + dev server readiness

The architecture already supports per-engine model strategy if desired.

---

## 3) Evaluate Gemini 3.1 Pro Preview Replacement

## 3.1 Technical feasibility

**Feasibility: High**

Minimal integration touchpoint for direct swap:
- `src/mastra/models.ts`

Because model IDs are centralized, replacing flash with 3.1 pro preview is low-code risk.

Potential secondary touchpoint:
- any fallback/default model in `src/lib/plugins/ai-service/mastra-provider.ts`

---

## 3.2 Expected upside

Potential gains (especially in hard prompts):
- Better long-horizon planning fidelity.
- Better instruction adherence for dense design specs.
- Stronger multi-step repair/edit loops (modify existing vs regenerate).
- Better complex scene choreography consistency.

---

## 3.3 Expected downside / risk

- **Latency:** pro-tier model likely slower in step-heavy tool loops.
- **Cost:** higher per-token pricing and reasoning token usage risk.
- **Quota/rate risk:** preview models frequently have stricter/volatile quotas.
- **Reliability drift:** preview behavior can change without stability guarantees.

Operationally, this can directly increase:
- stream timeouts,
- render start delays,
- user perception of sluggishness.

---

## 3.4 Integration complexity

- Code change complexity: **Low**
- Production rollout risk: **Medium** (mostly runtime economics/reliability)

No architecture rewrite needed.

---

## 3.5 Rollback plan

Because models are constant-driven:

1. Keep current flash model IDs in comments or env-switchable map.
2. Use feature flag / environment toggle per role:
   - orchestrator
   - remotion codegen
   - theatre codegen
3. Roll back instantly by reverting constants.
4. Preserve A/B telemetry by logging model used per run.

---

## 4) SVG-First Augmentation Evaluation

## 4.1 What “SVG-first” means in this stack

Generate one or more SVG assets (via deterministic code template and/or LLM), then feed them into existing media pipeline as first-class assets for Remotion/Theatre composition.

Primary use cases:
- logo motion,
- iconography,
- vector infographics/charts,
- typography-heavy scenes,
- crisp multi-resolution deliverables.

---

## 4.2 Technical feasibility

**Feasible with moderate effort.**

Why:
- Media pipeline already supports generic image paths.
- `detectMediaType()` includes `svg` as image extension (`analyze-media-tool.ts`).
- Remotion can render SVG via image/static paths in many cases.

Current gaps to address:

1. `stream/route.ts` extension handling does not robustly include `.svg` in `ensureExt()` logic.
2. MIME inference defaults can coerce unknown image types to PNG fallback.
3. No dedicated SVG sanitation/validation pass before writing to sandbox.

---

## 4.3 Integration points

### Ingest + normalization
- `src/app/api/plugins/animation/stream/route.ts`
  - add explicit SVG extension/mime handling.
  - preserve `.svg` filenames end-to-end.

### Codegen prompting
- `src/mastra/tools/animation/generate-remotion-code-tool.ts`
- `src/mastra/tools/animation/generate-code-tool.ts`
  - extend media instructions with SVG-specific usage hints.
  - encourage vector layering/animation patterns where appropriate.

### Optional new helper tool (future)
- e.g., `generate_svg_asset` tool for deterministic template-driven SVG creation.

---

## 4.4 Quality gains and risks

### Gains
- Sharper visuals for logos/icons/text-like art.
- Better scale behavior across 720p/1080p/4k outputs.
- Smaller assets vs equivalent high-res PNGs for many vector shapes.

### Risks
- Complex SVG filters/masks can be render-expensive or inconsistent.
- Untrusted SVG can carry script/style attack surfaces if not sanitized.
- Model may generate invalid SVG syntax without validation.

---

## 4.5 Performance implications

- Simple SVG: generally good.
- Very complex path/filter-heavy SVG: can increase rasterization/render costs per frame.
- Need pragmatic limits (path count/filter constraints) and fallback rasterization option.

---

## 4.6 Security / sandbox concerns

SVG is code-like markup and should be treated as untrusted input.

Recommended controls:
- sanitize/strip scripts, external refs, and unsafe attributes,
- deny `foreignObject` unless explicitly needed,
- enforce size/path complexity limits,
- disallow remote fetches from SVG references inside sandbox render path.

---

## 5) Recommendation Matrix

| Option | Summary | Quality | Latency | Cost | Reliability | Integration Effort | Rollback |
|---|---|---:|---:|---:|---:|---:|---:|
| A. Keep current model setup | Continue Gemini 3 Flash for orchestration+codegen | 3.5/5 | 4.5/5 | 4.5/5 | 4/5 | 5/5 | 5/5 |
| B. Full switch to Gemini 3.1 Pro preview | Replace orchestrator + codegen with 3.1 pro preview | 4.5/5 | 2.5/5 | 2/5 | 2.5/5 (preview risk) | 4/5 | 5/5 |
| C. Hybrid planner/generator split | 3.1 pro for planning/revision, flash for generation loop | 4.25/5 | 3.75/5 | 3.5/5 | 3.75/5 | 3.5/5 | 5/5 |
| D. SVG-first augmentation | Keep current model(s), add SVG pipeline path | 4/5 (for vector-centric content) | 4/5 | 4/5 | 3.5/5 | 3/5 | 4.5/5 |

### Recommended path

**Primary recommendation: Option C + D staged.**

- Start with **C** for better planning quality without exploding runtime cost.
- Add **D** selectively for prompts that are logo/vector/infographic dominant.

---

## 6) Experiment Plan (small, measurable)

## 6.1 Goal

Validate whether hybrid model strategy and SVG-first augmentation improve output quality enough to justify added complexity/cost.

## 6.2 Experiment design

### Cohorts

1. **Baseline:** current (Flash orchestration + Flash codegen)
2. **Hybrid:** Pro 3.1 for planning+revision, Flash for codegen/render loop
3. **Hybrid+SVG:** #2 plus SVG-first mode when prompt classified as vector-heavy

### Prompt suite

Minimum 30 prompts (balanced):
- 10 logo/brand motion
- 10 product/social promo
- 10 mixed media (image/video references)

### Metrics

Product quality:
- Plan acceptance rate (% accepted without manual revise)
- First-render success rate
- Human quality rubric (1–5)
- Edit-turn count to “acceptable output”

Runtime/perf:
- P50/P95 time to first plan
- P50/P95 time to final video
- Tool error rate (per run)

Economics:
- Tokens/run
- Cost/run
- Quota throttle incidents

---

## 6.3 Success criteria and go/no-go

### Go criteria (for Hybrid)

- +10% relative increase in plan acceptance rate
- +0.4 average quality score uplift
- ≤20% increase in P95 end-to-end latency
- ≤30% increase in median cost/run
- no significant reliability regression (error rate delta ≤2pp)

### Go criteria (for SVG-first)

- +0.5 quality uplift on vector-heavy subset
- No >10% render failure increase on SVG prompts
- No critical sandbox/security incident from SVG ingestion

### No-go triggers

- Preview model instability causing repeated regressions,
- quota throttling that impacts normal user flow,
- SVG path introduces unsafe content handling without sanitation.

---

## 7) Phased Rollout Recommendation

## Phase 0 (prep)
- Add role-level model flags and telemetry dimensions (model per step).
- Add SVG MIME/extension hardening in ingest path.

## Phase 1 (internal canary)
- Enable Hybrid on small internal cohort.
- Track latency/cost/error dashboards.

## Phase 2 (limited production)
- 10–20% traffic A/B.
- Gate SVG-first only for vector-classified prompts.

## Phase 3 (generalization)
- Promote Hybrid if go criteria met.
- Expand SVG-first with explicit user controls and fallback rasterization.

## Phase 4 (stabilization)
- Lock stable model defaults.
- Keep one-click rollback toggles.

---

## 8) Code Touchpoints (for future implementation)

### Current architecture touchpoints
- `src/mastra/models.ts` (model constants)
- `src/mastra/agents/animation-agent.ts`
- `src/mastra/agents/remotion-code-generator-agent.ts`
- `src/mastra/agents/code-generator-agent.ts`
- `src/app/api/plugins/animation/stream/route.ts`
- `src/mastra/tools/animation/generate-remotion-code-tool.ts`
- `src/mastra/tools/animation/generate-code-tool.ts`
- `src/mastra/tools/animation/sandbox-tools.ts`
- `src/mastra/tools/animation/analyze-media-tool.ts`
- `src/lib/plugins/official/agents/animation-generator/AnimationNode.tsx`
- `src/lib/plugins/official/agents/animation-generator/hooks/useAnimationStream.ts`

### SVG-first specific touchpoints
- `src/app/api/plugins/animation/stream/route.ts` (extension/mime + upload paths)
- `src/mastra/tools/animation/generate-remotion-code-tool.ts` (SVG usage instruction)
- `src/mastra/tools/animation/generate-code-tool.ts` (SVG usage instruction)
- Potential new sanitizer helper under `src/lib/` (future)

---

## 9) Risk Register

| ID | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | Gemini 3.1 Pro preview latency too high for interactive loop | Medium | High | Hybrid split; keep flash in generation path |
| R2 | Preview model behavior drift/regressions | Medium | High | Flagged rollout + quick rollback in model constants |
| R3 | Cost overrun from pro reasoning tokens | Medium | High | Budget caps, model routing by step, telemetry alerts |
| R4 | Quota throttling during peak use | Medium | Medium | Retry/backoff + fallback model path |
| R5 | SVG mime/ext mishandling corrupts assets | High (current gap) | Medium | Explicit `.svg` + `image/svg+xml` handling |
| R6 | SVG security payload in untrusted markup | Medium | High | Sanitize/strip scripts/external refs; enforce limits |
| R7 | Complex SVG render perf regressions | Medium | Medium | Complexity heuristics + optional raster fallback |

---

## 10) Final Recommendation

1. **Do not do an immediate full replacement (Option B) globally.**
2. **Adopt Option C (Hybrid) as the primary next step** for quality gains with controlled latency/cost risk.
3. **Pursue Option D (SVG-first) as a targeted augmentation** for vector-centric tasks, with sanitation and extension handling as prerequisites.
4. Keep Option A as operational fallback and baseline comparator.

This path maximizes upside while preserving rollback safety and throughput.
