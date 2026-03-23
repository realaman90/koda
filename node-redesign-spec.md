# Node Redesign Specification - KODA (spaces-clone)

## Overview
Redesign 3 components in canvas nodes for a modern, subtle, non-AI-slop aesthetic.

---

## 1. Loading States

### Current State
- `animate-pulse-glow` - Pulsing neon purple glow (Video nodes)
- `animate-pulse-glow-teal` - Pulsing neon teal glow (Image nodes)
- Uses box-shadow with bright colors (rgba 168,85,247 purple, rgba 20,184,166 teal)
- Creates "AI slop" neon aesthetic

### New Design
Replace neon glow with subtle alternatives:

1. **Skeleton loader with shimmer** (existing)
   - Already implemented in globals.css as `animate-shimmer`
   - Uses gray base with subtle white shimmer

2. **Minimal progress indicator**
   - Thin 2px line at bottom of card
   - Muted color (zinc-500 for light, zinc-600 for dark)
   - Smooth width transition

3. **Opacity pulse** (fallback)
   - 0.6 → 1.0 opacity animation
   - Applied to loading content wrapper

### Implementation
- Remove `animate-pulse-glow` and `animate-pulse-glow-teal` keyframes
- Replace with `animate-subtle-pulse` (opacity only)
- Add `loading-progress-bar` class for thin progress line
- Update VideoGeneratorNode and ImageGeneratorNode to use new loading styles

---

## 2. Video Hover Conflict

### Current State
- Video element has `controls` attribute (native browser controls)
- Floating toolbar appears on hover
- Both visible simultaneously = UI conflict

### New Design
- **Remove native `controls`** from video element
- Use floating toolbar as the ONLY control interface
- Toolbar appears on hover, hidden when not hovering
- Clean separation: hover = controls visible

### Implementation
- Remove `controls` prop from `<video>` element in VideoGeneratorNode
- Keep toolbar hover behavior (already implemented)
- Ensure play/pause works via toolbar buttons or by adding play trigger on video click

---

## 3. Settings Panel

### Current State
- `bg-zinc-900` background
- `border-zinc-700` borders  
- Purple accent buttons (`bg-purple-500`)
- Basic, utilitarian dark theme

### New Design
- Linear/Notion inspired - clean, minimal
- Muted tones: `bg-zinc-50` light / `bg-zinc-900` dark (proper theming)
- Subtle borders: `border-zinc-200` light / `border-zinc-800` dark
- Neutral buttons - no purple/teal accents
- Typography: 12px labels (uppercase, tracking-wide), 14px values
- 8px border radius max (sharper, less playful)

### Color Palette
| Element | Light Mode | Dark Mode |
|---------|------------|-----------|
| Background | `#ffffff` | `#18181b` |
| Border | `#e4e4e7` | `#27272a` |
| Text Primary | `#18181b` | `#fafafa` |
| Text Secondary | `#71717a` | `#a1a1aa` |
| Button Default | `#f4f4f5` | `#27272a` |
| Button Hover | `#e4e4e7` | `#3f3f46` |

---

## Files to Modify

1. **src/app/globals.css**
   - Remove `pulse-glow` keyframes
   - Remove `pulse-glow-teal` keyframes
   - Add `subtle-pulse` animation (opacity only)
   - Add `loading-progress-bar` styles

2. **src/components/canvas/nodes/VideoGeneratorNode.tsx**
   - Replace `animate-pulse-glow` with subtle loading
   - Remove `controls` from video element
   - Update border style during generation

3. **src/components/canvas/nodes/ImageGeneratorNode.tsx**
   - Replace `animate-pulse-glow-teal` with subtle loading
   - Update border style during generation

4. **src/components/canvas/VideoSettingsPanel.tsx**
   - Use theme-aware colors
   - Remove purple accents
   - Sharper 8px borders
   - Clean typography

---

## Rules Summary
- NO gradient backgrounds
- NO neon glow effects
- NO rounded corners > 8px
- Use muted colors (zinc-500, slate-400, etc.)
- Video controls must work without conflict
