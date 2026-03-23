# Spaces Clone — Full Design Audit (2026-02-21)

## Scope
Audited UI styling consistency across Dashboard, Canvas, Settings, Plugins, Node panels, and design docs.

Hard requirements checked:
1. No decorative gradients for generic CTA/buttons
2. Blue accent baseline `#3b82f6`
3. No glow / flashy animated borders
4. Consistent button system across surfaces
5. Clean minimal UX

---

## Executive Summary
**Status: FAIL (not yet compliant).**

The codebase has a partially-migrated design system (blue accent tokens exist), but legacy gradient/indigo/purple styles remain in key user paths.

### Highest-impact issues
- **Gradient CTA still present** on Dashboard “New project”.
- **Legacy gradient-border system still active** (`GradientBorderCard`, CSS utilities, animation keyframes).
- **Settings still uses indigo/purple accents** in multiple sections.
- **Node UI action controls are color-fragmented** (cyan/pink/amber/indigo/purple) instead of unified action styling.
- **Plugin surfaces are inconsistent** (hardcoded zinc + indigo, not tokenized).
- **Design docs conflict** (some specs still prescribe gradients/animated borders/glows).

---

## Findings by Requirement

### R1 — Remove decorative gradients for generic CTA/buttons ❌
**Violations**
- `src/components/dashboard/DashboardHeader.tsx` — “New project” uses amber→pink gradient + glow-like colored shadow.
- `src/components/common/GradientBorderCard.tsx` — full gradient border component used by dashboard cards.
- `src/components/dashboard/CanvasCard.tsx` — wraps cards in `GradientBorderCard`.
- `src/app/globals.css` — gradient utility classes + animated gradient border:
  - `.bg-gradient-accent-subtle`, `.bg-gradient-accent-dark`, `.border-gradient-accent`, `.animate-gradient-border`, `@keyframes gradient-rotate`, `.shadow-gradient-accent`.

**Notes**
- Gradients used on media overlays (image/video preview fades) are contextual and acceptable.
- Generic CTA/surface gradients are not acceptable per requirements.

### R2 — Accent baseline blue `#3b82f6` unless semantic color required ❌
**Violations (generic controls using non-blue accent):**
- Settings:
  - `src/components/settings/sections/ThemeSection.tsx`
  - `src/components/settings/sections/CanvasPreferencesSection.tsx`
  - `src/components/settings/sections/GenerationSettingsSection.tsx`
  - `src/components/settings/sections/StorageSection.tsx`
  - `src/components/settings/sections/HistorySection.tsx`
  - `src/components/settings/sections/ProfileSection.tsx` (gradient avatar)
- Dashboard/Layout:
  - `src/components/dashboard/CreateCanvasButton.tsx` (indigo hovers)
  - `src/components/dashboard/TemplateCard.tsx` (indigo ring)
  - `src/components/layout/TopBar.tsx` (purple/pink gradient avatar)
- Canvas panels/tools:
  - `src/components/canvas/SettingsPanel.tsx` (purple “Magic” state)
  - `src/components/canvas/ZoomControls.tsx` (indigo selected preset)
- UI base components:
  - `src/components/ui/slider.tsx` (teal range)
  - `src/components/ui/mention-editor.tsx` (purple music icon)

**Node-level inconsistency beyond allowed domain cues:**
- `src/components/canvas/nodes/StoryboardNode.tsx` (indigo controls/focus/actions)
- `src/components/canvas/nodes/ProductShotNode.tsx` (amber used for generic form focus + CTAs)
- `src/components/canvas/nodes/SpeechNode.tsx` (cyan controls + rings)
- `src/components/canvas/nodes/VideoAudioNode.tsx` (pink/purple/indigo mixed controls)
- `src/components/canvas/nodes/StickerNode.tsx` / `StickyNoteNode.tsx` (indigo toggles/sliders)

### R3 — No glow effects / flashy animated borders ❌
**Violations**
- `src/components/common/GradientBorderCard.tsx` — animated gradient-border hover treatment.
- `src/app/globals.css` — `@keyframes gradient-rotate`, `.animate-gradient-border`, `.shadow-gradient-accent`.
- Node selection/active states use colored shadow glows:
  - `SpeechNode.tsx`, `VideoAudioNode.tsx`, `ProductShotNode.tsx`, `StoryboardNode.tsx` (ring + colored shadow patterns).
- `src/components/canvas/edges/DeletableEdge.tsx` — selected edge hardcoded pink (`#f472b6`) instead of system selection color.

### R4 — Consistent button system across product surfaces ❌
**Violations**
- Significant amount of **hand-rolled button classes** and duplicated patterns instead of shared `Button` variants.
- Dashboard, Settings, Node panels, and plugin views each implement separate button styles.
- `src/lib/plugins/official/storyboard-generator/StoryboardSandbox.tsx` uses independent indigo-based button/input system.
- `src/components/plugins/PluginLauncher/index.tsx` and `src/components/plugins/AgentSandbox/index.tsx` use hardcoded zinc styles, detached from token system.

### R5 — Keep UX clean/minimal ⚠️ Partially
**Good**
- Core tone is mostly minimal and restrained.
- Base token setup in `globals.css` includes blue accent variables.

**Not clean/minimal yet**
- Legacy decorative systems coexist with new system.
- Multiple accent hues for generic actions creates visual noise.
- Documentation drift causes reintroduction of forbidden patterns.

---

## Concrete Inconsistent Files/Components

### A) Must-fix now (P0)
1. `src/components/dashboard/DashboardHeader.tsx` — gradient CTA + accent shadow.
2. `src/components/common/GradientBorderCard.tsx` — gradient border component.
3. `src/components/dashboard/CanvasCard.tsx` — dependency on gradient card.
4. `src/app/globals.css` — remove legacy gradient/accent classes + animated border utilities.
5. `src/components/layout/TopBar.tsx` — gradient avatar treatment.
6. `src/components/settings/sections/ThemeSection.tsx` — indigo accents.
7. `src/components/settings/sections/CanvasPreferencesSection.tsx` — indigo toggles/buttons.
8. `src/components/settings/sections/GenerationSettingsSection.tsx` — indigo toggles/buttons.
9. `src/components/canvas/SettingsPanel.tsx` — purple “Magic” toggle style.
10. `src/components/canvas/edges/DeletableEdge.tsx` — pink selected edge stroke.

### B) Node action/button consistency (P1)
11. `src/components/canvas/nodes/StoryboardNode.tsx`
12. `src/components/canvas/nodes/storyboard/StoryboardDraftCard.tsx`
13. `src/components/canvas/nodes/ProductShotNode.tsx`
14. `src/components/canvas/nodes/SpeechNode.tsx`
15. `src/components/canvas/nodes/VideoAudioNode.tsx`
16. `src/components/canvas/nodes/VideoGeneratorNode.tsx`
17. `src/components/canvas/nodes/ImageGeneratorNode.tsx`
18. `src/components/canvas/nodes/StickerNode.tsx`
19. `src/components/canvas/nodes/StickyNoteNode.tsx`
20. `src/components/canvas/ZoomControls.tsx`

### C) Plugin surface consistency (P1)
21. `src/components/plugins/PluginLauncher/index.tsx`
22. `src/components/plugins/AgentSandbox/index.tsx`
23. `src/lib/plugins/official/storyboard-generator/StoryboardSandbox.tsx`
24. `src/lib/plugins/official/agents/animation-generator/AnimationNode.tsx`
25. `src/lib/plugins/official/agents/animation-generator/components/ChatInput.tsx`
26. `src/lib/plugins/official/agents/animation-generator/components/ChatMessages.tsx`
27. `src/lib/plugins/official/agents/motion-analyzer/MotionAnalyzerNode.tsx`

### D) Secondary consistency cleanup (P2)
28. `src/components/dashboard/CreateCanvasButton.tsx`
29. `src/components/dashboard/TemplateCard.tsx`
30. `src/components/settings/sections/StorageSection.tsx`
31. `src/components/settings/sections/HistorySection.tsx`
32. `src/components/settings/sections/ProfileSection.tsx`
33. `src/components/ui/slider.tsx`
34. `src/components/ui/mention-editor.tsx`

### E) Documentation conflicts (P0)
35. `docs/specs/SPEC-002-gradient-accent-colors.md` (contradicts new direction)
36. `docs/specs/SPEC-003-animated-card-hover-borders.md` (contradicts new direction)
37. `docs/specs/SPEC-004-cmdk-command-palette.md` (gradient selected states)
38. `docs/specs/SPEC-005-fab-ai-assist.md` (gradient/glow guidance)
39. `docs/specs/SPEC-006-framer-motion-animations.md` (border glow guidance)

---

## Prioritized Implementation Checklist (for engineering)

### P0 — Blockers (ship first)
- [ ] Replace dashboard gradient CTA with solid primary button token.
- [ ] Retire `GradientBorderCard` usage on dashboard cards.
- [ ] Remove gradient/animated-border utility classes from `globals.css`.
- [ ] Replace remaining purple/indigo accents in Settings with blue tokens.
- [ ] Normalize selection/active color in edge + node selection states to system blue.
- [ ] Mark legacy gradient specs as deprecated and anchor to new `docs/specs/SPEC.md`.

### P1 — System consistency (next)
- [ ] Define node-level rule: domain hue for headers/handles only; controls/actions use system button tokens.
- [ ] Refactor node buttons/toggles/chips to shared component variants.
- [ ] Migrate plugin launcher/sandbox/storyboard sandbox to design tokens and shared controls.
- [ ] Ensure focus treatment uses one rule (`ring` token) everywhere.

### P2 — Polish
- [ ] Remove residual indigo/teal/purple utility usage in minor controls.
- [ ] Normalize icon accent logic in mention editor and tool strips.
- [ ] Add visual regression snapshots for Dashboard, Settings, Canvas, Plugins.

---

## Risk Notes
- Existing plugin UIs (especially official agent nodes) are the largest migration surface and should be phased.
- Some color cues in image/video/audio nodes are useful; preserve those cues only for **identity/content markers**, not generic actions.

