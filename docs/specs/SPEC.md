# Spaces Clone Unified Design System SPEC

**Status:** Active (source of truth)  
**Date:** 2026-02-21  
**Replaces visual direction from:** SPEC-002/003/004/005/006 where conflicting.

---

## 1) Design Intent
A clean, professional, Codex/Linear/Vercel-like interface:
- Minimal visual noise
- Strong hierarchy
- Predictable interactions
- One accent baseline
- No decorative effects

---

## 2) Non-Negotiable Rules
1. **No decorative gradients** for generic CTA/buttons/cards/borders.
2. **Primary accent baseline is blue `#3b82f6`.**
3. **No glow effects** (colored bloom/shadow glows), no flashy animated borders.
4. **One shared button system** across Dashboard, Canvas, Settings, Plugins, Node panels.
5. **Node domain hues allowed only as identity cues** (headers/handles/badges/content cues), not generic UI actions.

---

## 3) Color & Token System

## 3.1 Core tokens
```css
--accent-primary: #3b82f6;
--accent-primary-hover: #2563eb;
--accent-primary-active: #1d4ed8;
--accent-primary-fg: #ffffff;

--focus-ring: rgba(59, 130, 246, 0.35);
--focus-ring-strong: rgba(59, 130, 246, 0.5);

--border-default: hsl(var(--border));
--border-strong: color-mix(in oklab, hsl(var(--border)) 70%, hsl(var(--foreground)) 30%);

--danger: #ef4444;
--danger-hover: #dc2626;
--danger-fg: #ffffff;

--success: #22c55e;
--warning: #f59e0b;
--info: #3b82f6;
```

## 3.2 Semantic color policy
- **Primary actions / selected interactive states:** blue tokens only.
- **Destructive:** red tokens only.
- **Success/warning/info:** for status messaging only.
- **Do not use amber/purple/indigo/teal/pink as generic action colors.**

## 3.3 Node domain cue policy
Allowed domain hues (for identity only):
- Image: teal family
- Video: violet family
- Audio/music: pink family
- Text/editor: amber family

Allowed usage:
- node title/icon, handle markers, media-type badges, content overlays.

Not allowed usage:
- primary buttons, form focus rings, toggles, chips, tabs, command selection.

---

## 4) Interaction & Motion Rules
- Hover: subtle bg/border change (no color bloom).
- Active: slight darken/compress, no dramatic transforms.
- Focus-visible: consistent ring using `--focus-ring`.
- Loading: spinner/skeleton/pulse only (subtle), no gradient shimmer for CTA text.
- Avoid decorative motion loops unrelated to user intent.

---

## 5) Component Standards

## 5.1 Buttons (single shared system)
Variants:
- **Primary:** solid blue bg, white text.
- **Secondary/Outline:** neutral surface + border.
- **Ghost:** transparent bg, subtle hover fill.
- **Destructive:** red semantic.

States:
- Hover: `primary-hover`
- Active: `primary-active`
- Disabled: lowered opacity + no pointer
- Focus: consistent ring

Banned:
- gradient button backgrounds
- colored glow shadows
- per-feature accent recolors for generic actions

## 5.2 Chips / Pills / Badges
- **Interactive chips** (filters/toggles): selected state uses blue tint + blue text.
- **Status chips** may use semantic colors (success/warn/error).
- Keep radii, padding, typography consistent across modules.

## 5.3 Command Palette
- Surface uses global popover/card tokens.
- Selected item: blue-tinted background + blue text.
- No gradient-selected rows.
- Shortcut keycaps remain neutral.

## 5.4 Node UI Standards
- Node shell: neutral surface + subtle border.
- Node selected state: blue ring/border treatment only.
- Generic controls inside nodes (Generate, Apply, Toggle, tabs): shared button/input tokens.
- Domain cue color appears only in identity zones (title/icon/handles/media badge).

## 5.5 Plugin Surfaces
- Plugin launcher and sandbox must use global surface and border tokens.
- Plugin form controls must follow shared input/select/button standards.
- No plugin-local accent systems that override global action language.

## 5.6 Inputs / Select / Sliders / Toggles
- Focus ring: blue token only.
- Slider range and toggle ON state: blue.
- Invalid state: destructive token.
- No component-specific indigo/teal/purple defaults for generic control states.

---

## 6) Surface Standards by Area

### Dashboard
- Primary CTA = shared primary button.
- Project/template cards = neutral border card, no gradient border animation.

### Canvas
- Toolbars, popovers, settings panels = tokenized neutral surfaces.
- Selection, active modes, quick actions = blue interactive language.

### Settings
- All tab selections, toggles, previews, and active controls = blue baseline.
- Remove purple/indigo decorative accents.

### Plugins
- Visual language must match app-level controls.
- Hardcoded zinc-only palettes should be replaced with theme tokens.

---

## 7) Migration / Enforcement

## 7.1 Immediate deprecations
Deprecated patterns:
- `GradientBorderCard`
- gradient accent utility classes for generic controls
- animated gradient border classes
- pink/purple selected edge hardcodes

## 7.2 Lintable conventions (recommended)
- Disallow `bg-gradient-*` in generic button/card components.
- Disallow `focus:ring-indigo-*`, `focus:ring-purple-*`, etc. in app UI.
- Enforce `Button` component usage for action buttons where practical.

## 7.3 QA gates
Before merge, verify visual consistency on:
- Dashboard (New project + cards)
- Settings (all sections)
- Canvas (node selection + settings panel)
- Plugin Launcher + each official sandbox/node panel

---

## 8) Implementation Priorities

### P0
- Dashboard CTA and card gradient removal
- Settings accent normalization to blue
- Remove gradient utility debt from globals
- Update conflicting legacy specs docs

### P1
- Node control unification (buttons/toggles/focus)
- Plugin surface tokenization and control consistency
- Shared chip/toggle patterns across modules

### P2
- Cleanup residual one-off accent classes
- Add visual regression suite for core routes

---

## 9) Definition of Done
Design system migration is complete when:
- No generic CTA/button/card uses gradient or glow.
- Blue is the only default interactive accent.
- Node/plugin controls match shared component behavior.
- Domain colors are limited to identity cues only.
- Cross-surface UI (Dashboard/Canvas/Settings/Plugins) reads as one product.

