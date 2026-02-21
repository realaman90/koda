# Design Consistency Audit: KODA

**Date:** 2026-02-21  
**Auditor:** Designer Subagent  
**Scope:** Dashboard, Settings, Canvas pages

---

## Executive Summary

The app has a **modern, well-structured foundation** with CSS variables for theming, but suffers from **inconsistent implementation** across pages. The Dashboard uses the design system correctly, while Settings and several UI components fall back to hardcoded zinc colors, creating visual fragmentation.

**Verdict:** Not AI slop — there's clear design intent — but needs cleanup for true cohesion.

---

## 1. Cohesion Between Pages

### Dashboard ✅ (Good)
- Uses theme-aware CSS variables: `bg-background`, `text-foreground`, `border-border`, `bg-muted`
- Consistent with the design system laid out in `globals.css`
- Cards, headers, buttons all use the token system

### Canvas ✅ (Good, but separate system)
- Has its **own extensive CSS variable system** specifically for nodes
- Variables like `--node-card-bg`, `--node-border-selected`, `--node-title-*`
- This is intentional — canvas is a different visual context
- Works well within its domain

### Settings ⚠️ (Inconsistent)
- Header uses theme variables correctly
- **Settings sections hardcode `zinc-*` colors** (e.g., `text-zinc-200`, `bg-zinc-800`, `border-zinc-700`)
- This breaks theme switching — Settings will look wrong in light mode

**Finding:** Settings pages need migration to use theme tokens instead of hardcoded zinc values.

---

## 2. Typography Consistency ✅

**Font Stack:**
- Primary: `var(--font-geist-sans)` 
- Mono: `var(--font-geist-mono)`

**Usage:**
- Dashboard: `text-sm`, `text-lg`, `font-medium`, `font-semibold`, `text-muted-foreground`
- Settings: Same classes, but mixed with hardcoded colors
- Canvas nodes: Consistent within node components

**Status:** Typography is well-controlled. No font-size inconsistencies found.

---

## 3. Color Palette

### Design System (in `globals.css`)

**Primary Accent:**
- `--accent-primary`: #7C3AED (Purple)
- `--accent-primary-hover`: #6D28D9
- `--accent-primary-fg`: #FFFFFF

**Base Colors (Light):**
- `--background`: oklch(1 0 0) — pure white
- `--foreground`: oklch(0.145 0 0) — near black
- `--card`: oklch(1 0 0)
- `--border`: oklch(0.922 0 0)

**Base Colors (Dark):**
- `--background`: oklch(0.145 0 0)
- `--foreground`: oklch(0.985 0 0)
- `--card`: oklch(0.205 0 0)
- `--border`: oklch(1 0 0 / 10%)

### Problems Found

1. **Settings hardcodes zinc palette:**
   - `text-zinc-200`, `text-zinc-300`, `text-zinc-500`
   - `bg-zinc-800`, `bg-zinc-700`, `bg-zinc-800/50`
   - `border-zinc-700`, `border-zinc-600`

2. **UI components hardcode zinc:**
   - `popover.tsx`: `bg-zinc-800`, `border-zinc-700`
   - `dropdown-menu.tsx`: Same pattern
   - `slider.tsx`: `bg-zinc-700`, `border-zinc-600`

3. **Mixing approaches in same files:**
   - `ApiKeysSection.tsx`: Uses both `text-foreground` AND `text-zinc-200`
   - `ThemeSection.tsx`: Uses `bg-indigo-500/10` (correct) but preview uses inline styles

---

## 4. Spacing & Layout Patterns ✅

**Container widths:**
- Dashboard: `max-w-[1600px] mx-auto px-6 py-8`
- Settings: `max-w-6xl mx-auto px-6 py-8`

**Card patterns:**
- Dashboard cards: `rounded-xl border border-border`
- Settings cards: `bg-card/50 rounded-xl border border-border p-6`
- Canvas nodes: `rounded-2xl` (different context, intentional)

**Spacing scale:**
- Consistent use of `gap-1`, `gap-2`, `gap-3`, `gap-4`, `gap-8`
- Padding: `px-3 py-2`, `px-4 py-2`, `p-4`, `p-6`

**Status:** Spacing is consistent and well-organized.

---

## 5. Component Patterns

### Button Variants
Defined in `button.tsx` with CVA:
- `default`: Primary accent
- `destructive`: Red for delete actions
- `outline`: Border with transparent bg
- `secondary`: Muted background
- `ghost`: Hover state only
- `link`: Underlined text

Used consistently across Dashboard and Canvas.

### Card Component
- Uses theme variables: `bg-card`, `text-card-foreground`, `border-border`
- Consistent `rounded-xl`, `shadow-sm`

### Input Fields
- Dashboard: Uses `bg-muted border-border`
- Settings: Hardcoded `bg-zinc-800 border-zinc-700` ❌

---

## 6. Overall Assessment

### What Works ✅
1. Clear design system in `globals.css` with CSS variables
2. OKLCH color space (modern, perceptually uniform)
3. Tailwind v4 with custom theme configuration
4. Consistent spacing and layout patterns
5. Good component abstraction (Button, Card, Input)
6. Canvas has its own coherent visual language

### What Needs Fixing ⚠️

1. **Settings pages break in light mode**
   - Hardcoded `zinc-*` colors won't adapt
   - Need to replace with theme tokens

2. **UI components (Popover, Dropdown, Slider)**
   - Use hardcoded dark zinc colors
   - Should use `bg-popover`, `border-border`

3. **Mixing patterns in settings sections**
   - Some use theme vars, some use zinc
   - Creates visual inconsistency even in dark mode

4. **Animation node has separate theme vars**
   - `--an-*` variables duplicate existing tokens
   - Consider consolidating or clearly documenting separation

---

## Recommendations

### Priority 1: Fix Settings for Light Mode
Replace hardcoded zinc colors with theme tokens:
```tsx
// Instead of:
className="text-zinc-200 bg-zinc-800 border-zinc-700"

// Use:
className="text-foreground bg-card border-border"
```

### Priority 2: Fix UI Components
Update `popover.tsx`, `dropdown-menu.tsx`, `slider.tsx` to use theme variables.

### Priority 3: Audit All Settings Sections
- ApiKeysSection
- ProfileSection  
- KeyboardShortcutsSection
- HistorySection
- StorageSection

### Priority 4: Document the Canvas System
The canvas node variables are extensive and well-designed. Document them to prevent duplication.

---

## Visual Examples

### Dashboard (Correct)
```tsx
<div className="bg-card border-border text-foreground">
  <h3 className="text-sm font-medium">Title</h3>
</div>
```

### Settings (Incorrect - breaks in light mode)
```tsx
<div className="bg-zinc-800 border-zinc-700 text-zinc-200">
  <h3 className="text-sm font-medium text-zinc-300">Title</h3>
</div>
```

---

## Conclusion

**Is it AI slop?** No. The design shows clear thought:
- Modern color space (OKLCH)
- Well-organized CSS variable system
- Consistent layout/spacing
- Coherent visual language for canvas nodes

**The issue:** Incomplete migration to the design system. Some components still use the old hardcoded zinc palette, primarily in Settings. This creates fragmentation and breaks light mode.

**Effort to fix:** Medium — requires updating ~5-8 files to use theme tokens instead of hardcoded zinc colors.
