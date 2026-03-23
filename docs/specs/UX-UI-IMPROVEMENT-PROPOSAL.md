# Spaces Clone — UX/UI Improvement Proposal

## Purpose
Translate audit findings into a concrete, implementation-ready product direction (design/spec only).

Design language targets:
- Clean, product-first, minimal surfaces (Codex/Linear/Vercel style)
- Blue primary action baseline `#3b82f6`
- No decorative gradients/glows in core app controls

---

## 1) Improvement Proposal (with Rationale + Expected Impact)

## A. Dashboard: Real Canvas Preview System (Primary Initiative)

### Proposal
Replace generic dashboard tile imagery with **actual canvas snapshot previews** generated from canvas content, with explicit fallback states.

### Why
- Highest impact on orientation, trust, and recovery-to-work speed.
- Makes dashboard a true “workspace index”, not a generic list.

### Expected UX impact
- Faster canvas re-entry and lower recognition effort.
- Better confidence in recency/activity status.
- Stronger perceived product quality.

---

## B. Card Behavior Contract (Preview + Metadata + Actions)

### Proposal
Define a canonical card model with 4 layers:
1. **Preview layer** (snapshot)
2. **State layer** (empty/stale/processing/error badges)
3. **Metadata layer** (name, relative time, node count, optional tags)
4. **Action layer** (open, rename, duplicate, delete, pin) with keyboard/touch parity

### Why
- Current actions and states are fragmented/hover-dependent.

### Expected UX impact
- Faster scanability and safer action execution.
- Better accessibility and mobile parity.

---

## C. Navigation + Mental Model Normalization

### Proposal
- Make settings tabs URL-addressable.
- Add explicit plugin launch mode cues (Node / Modal badge in launcher).
- Preserve user context across dashboard/canvas/settings transitions.

### Why
- Predictability and continuity are currently inconsistent.

### Expected UX impact
- Lower cognitive load.
- Better shareability/deep-linking for teams and QA.

---

## D. Node Editor Ergonomics Standardization

### Proposal
- Standardize per-node control zones: header actions, content, footer quick controls.
- Ensure critical actions are not hover-only.
- Define compact mode behavior for narrow viewports.

### Why
- Node-specific divergence creates relearning cost.

### Expected UX impact
- Faster mastery and reduced misclicks.

---

## E. State Quality + Accessibility Upgrade

### Proposal
- Replace spinner-only states with skeleton/context placeholders where possible.
- Add structured error surfaces with “retry / inspect / dismiss”.
- Enforce keyboard-visible focus and semantic labels on icon actions.

### Expected UX impact
- Higher reliability perception and better inclusive usability.

---

## 2) Updated SPEC Proposal (Component-Level Requirements)

## SPEC-UX-007 — Dashboard Canvas Preview System

### Data model
Extend/normalize canvas metadata:
- `thumbnailUrl?: string`
- `thumbnailUpdatedAt?: number`
- `thumbnailStatus: 'ready' | 'empty' | 'stale' | 'processing' | 'error'`
- `thumbnailVersion?: string` (optional hash for cache busting)

### Generation rules
- Trigger preview generation when:
  1. Canvas saved and visual graph changed materially
  2. First successful image/video output appears
  3. User explicitly requests “Refresh preview”
- Debounce generation to avoid churn (`>= 2s` inactivity window after save).

### Refresh policy
- Soft refresh: on relevant save events.
- Hard refresh: manual action from card menu.
- Stale threshold: mark stale if preview older than latest meaningful canvas update.

### Fallback states
- `empty`: no visual nodes yet → neutral empty illustration + “No preview yet”.
- `processing`: skeleton shimmer + “Updating preview…”.
- `error`: neutral error badge + retry action.
- `stale`: show preview with subtle stale badge and refresh affordance.

### Performance requirements
- Lazy-load previews using viewport intersection.
- `img` decoding async + fixed aspect ratio to prevent layout shift.
- Cache headers/versioned URLs for remote storage.
- Do not block dashboard first paint on thumbnail generation.

### Accessibility requirements
- Card is one primary interactive target + explicit secondary action menu.
- Menu actions keyboard reachable and labelled.
- State badges have text equivalents for screen readers.

---

## SPEC-UX-008 — CanvasCard Interaction Contract

### Card layout
- Aspect ratio: `16:9` preview area (consistent).
- Metadata stack:
  - Line 1: canvas name (editable via menu action)
  - Line 2: `updatedAt • nodeCount` (+ optional sync/status chip)

### Action model
- Primary click/tap: open canvas.
- Secondary menu always available (not hover-only on touch/keyboard).
- Quick actions in hover/focus: Open, Duplicate, Rename, Delete, Refresh preview.

### Visual states
- Default, hover, focus-visible, selected/open-recently.
- All action emphasis uses blue baseline (`#3b82f6`) for generic actions.

---

## SPEC-UX-009 — Settings + Plugin Navigation Consistency

### Settings
- URL format: `/settings?tab=<id>`.
- Preserve tab state on refresh/share/back.
- Section header includes concise description + risk framing where relevant.

### Plugin launcher
- Each plugin row shows:
  - type badge: `Node` or `Modal`
  - required input hints (if any)
  - output type hint
- Keep launch behavior predictable from pre-click information.

---

## SPEC-UX-010 — Responsive + Accessibility Baseline

### Responsive rules
- Define breakpoints for interaction mode, not just layout.
- On touch/narrow viewports:
  - expose actions without hover dependency
  - preserve minimum tap target size 40x40
  - provide collapsible/stacked metadata

### Accessibility
- All icon-only buttons require accessible names.
- Strong focus-visible ring tokens.
- Keyboard path for all dashboard and settings actions.

---

## 3) Phased Implementation Roadmap (P0 / P1 / P2)

## P0 — Trust + Continuity (Must Ship First)
1. Implement preview metadata states + fallback taxonomy.
2. Wire thumbnail lifecycle (generate/refresh/stale detection).
3. Upgrade CanvasCard action model for keyboard/touch parity.
4. Make settings tabs URL-addressable.

### P0 Acceptance Criteria
- >= 90% canvases with visual content show non-placeholder preview.
- No hover-only critical actions on dashboard cards.
- Settings tab persists via URL and browser refresh/back.
- Dashboard loads with stable card layout (no major CLS from preview load).

---

## P1 — Consistency + Ergonomics
1. Standardize card metadata/action layering.
2. Plugin launcher includes mode + IO hints.
3. Normalize node control zones across core node types.
4. Improve loading/error state components (skeletons + structured retry).

### P1 Acceptance Criteria
- 100% plugin entries disclose launch mode before click.
- Core node types follow shared control-zone template.
- Spinner-only loading removed from primary list surfaces.

---

## P2 — Polish + Optimization
1. Advanced caching/versioning for preview assets.
2. Add “recently opened / pinned” card enhancements.
3. Final microcopy pass for naming consistency (`project/canvas/space`).
4. Responsive density tuning for small and large displays.

### P2 Acceptance Criteria
- Preview fetch overhead remains bounded under large project lists.
- Mobile dashboard actions require no hover assumptions.
- Naming and action labels are consistent across shell surfaces.

---

## 4) Before/After UX Checklist (QA Validation)

## Dashboard Preview
- [ ] Card shows real canvas snapshot when available
- [ ] Empty/processing/stale/error preview states are visually and textually distinct
- [ ] Manual “Refresh preview” works and updates status correctly
- [ ] Preview loading does not shift card layout

## Card Actions + Metadata
- [ ] Open/rename/duplicate/delete reachable by mouse, keyboard, and touch
- [ ] Action affordances visible without hover on touch devices
- [ ] Metadata remains readable at small widths

## Navigation Flow
- [ ] Dashboard -> Canvas -> back returns user to expected context
- [ ] Settings tab is URL-synced and survives refresh
- [ ] Plugin launcher clearly indicates Node vs Modal behavior

## Node Editor Consistency
- [ ] Core node families share control placement logic
- [ ] Critical actions are not hidden behind hover only
- [ ] Focus states are visible and consistent

## Accessibility + States
- [ ] Icon-only actions have labels/aria names
- [ ] Keyboard-only users can complete primary flows
- [ ] Empty/loading/error states include next-step guidance

## Responsive
- [ ] Dashboard remains usable at 390px width without hidden critical actions
- [ ] Tap targets are >= 40px where actionable
- [ ] Canvas controls degrade gracefully on compact viewports

---

## 5) Success Metrics (Post-Launch)
- Time-to-open-correct-canvas from dashboard (median) decreases.
- Mis-open rate (open then immediate back) decreases.
- Preview coverage ratio and freshness ratio increase.
- Mobile action completion rate improves.
- Settings navigation drop-off decreases (tab continuity improved).

---

## Final Note
If only one initiative is prioritized, ship **SPEC-UX-007 + SPEC-UX-008 (real dashboard previews + card contract)** first. This delivers the largest UX gain with immediate user-visible value and establishes the interaction quality bar for the rest of the product.
