# Deep Node UX Audit: Koda (spaces-clone)

**Date:** 2026-02-21  
**Auditor:** Designer Agent  
**Focus:** Canvas Nodes Only (NOT pages/templates)

---

## Executive Summary

The Koda canvas nodes have **moderate AI slop violations**, primarily in loading/generation states rather than static design. The most severe issues are the **pulsing glow animations** during content generation, which create an intentionally "flashy" AI aesthetic that contradicts modern minimalist design principles. Static node designs are generally clean but use saturated category colors and rounded corners.

---

## Node Types Analyzed

| Node Type | File | Status |
|-----------|------|--------|
| Text Node | `TextNode.tsx` | ✅ Clean |
| Image Generator | `ImageGeneratorNode.tsx` | ⚠️ Glow violation |
| Video Generator | `VideoGeneratorNode.tsx` | ⚠️ Glow violation |
| Music Generator | `MusicGeneratorNode.tsx` | ⚠️ Glow violation |
| Media Node | `MediaNode.tsx` | ✅ Clean |

---

## Detailed Findings

### 1. Image Generator Node

#### Color Palette
- **Node Title:** Teal (`#0f766e` light / `#14b8a6` dark) - moderately saturated
- **Accent Color:** Teal (`#14b8a6`) for generation button and handles
- **AI Slop Violation:** ❌ None in static state

#### Loading States
- **Spinning loader:** Teal border (`border-t-teal-500`) on gray spinner
- **Glow Effect:** ⚠️ **`animate-pulse-glow-teal`** - pulsing teal glow box-shadow during generation
- **Border:** Teal border (`2.5px solid #14b8a6`) during generation
- **AI Slop Violation:** ⚠️ **YES** - The pulsing glow creates an overly flashy "AI working" animation

```css
/* From globals.css */
@keyframes pulse-glow-teal {
  0%, 100% {
    box-shadow: 0 0 15px 2px rgba(20, 184, 166, 0.4),
                0 0 30px 5px rgba(20, 184, 166, 0.2),
                inset 0 0 8px rgba(20, 184, 166, 0.1);
  }
  50% {
    box-shadow: 0 0 25px 5px rgba(20, 184, 166, 0.6),
                0 0 50px 10px rgba(20, 184, 166, 0.3),
                inset 0 0 15px rgba(20, 184, 166, 0.2);
  }
}
```

#### Typography & Spacing
- Font: System/default (Inter Geist)
- Node title: 14px font-medium
- Content area: 14px for textarea
- Padding: 12px (p-3), 16px (p-4)
- **Verdict:** ✅ Adequate, professional spacing

#### Icons
- Using Lucide React icons (`ImageIcon`, `Sparkle`, `Play`, `Settings`, etc.)
- **AI Slop Violation:** ⚠️ Generic iconography (Lucide is overused in AI products)

#### Interaction Patterns
- Hover reveals toolbar above node
- Floating toolbar on selection
- Hover states on all controls
- **Verdict:** ✅ Good UX, intuitive

---

### 2. Video Generator Node

#### Color Palette
- **Node Title:** Purple (`#7c3aed` light / `#a855f7` dark) - high saturation
- **Accent Color:** Purple (`#a855f7`) for generation button and handles
- **AI Slop Violation:** ⚠️ Saturated purple is a common "AI" color

#### Loading States
- **Spinning loader:** Purple border (`border-t-purple-500`) on gray spinner
- **Glow Effect:** ⚠️ **`animate-pulse-glow`** - pulsing **purple** glow box-shadow during generation
- **Border:** Purple border (`2.5px solid #a855f7`) during generation
- **AI Slop Violation:** ⚠️ **YES** - Same glow animation issue as Image Generator

```css
/* From globals.css */
@keyframes pulse-glow {
  0%, 100% {
    box-shadow: 0 0 15px 2px rgba(168, 85, 247, 0.4),
                0 0 30px 5px rgba(168, 85, 247, 0.2),
                inset 0 0 8px rgba(168, 85, 247, 0.1);
  }
  50% {
    box-shadow: 0 0 25px 5px rgba(168, 85, 247, 0.6),
                0 0 50px 10px rgba(168, 85, 247, 0.3),
                inset 0 0 15px rgba(168, 85, 247, 0.2);
  }
}
```

#### Typography & Spacing
- Same as Image Generator
- **Verdict:** ✅ Consistent with other nodes

#### Icons
- Lucide icons (`Video`, `Play`, `Settings`, `RefreshCw`, `Volume2`, etc.)
- **AI Slop Violation:** ⚠️ Generic

#### Interaction Patterns
- Hover reveals controls with gradient overlay
- Progress tracking with elapsed time
- **Verdict:** ✅ Good UX with progress feedback

---

### 3. Music Generator Node

#### Color Palette
- **Node Title:** Orange (`#ea580c` light / `#fb923c` dark) - high saturation
- **Accent Color:** Orange (`#fb923c`) for generation button and handles
- **AI Slop Violation:** ⚠️ Saturated orange is common "AI audio" color

#### Loading States
- **Spinning loader:** Orange border (`border-t-orange-500`)
- **Glow Effect:** ⚠️ **Different animation** - uses `animate-pulse-glow` with orange shadow via `shadow-lg shadow-orange-500/20`
- **AI Slop Violation:** ⚠️ **YES** - Pulse effect on generation button

#### Typography & Spacing
- Consistent with other nodes
- **Verdict:** ✅ Adequate

#### Icons
- Lucide icons (`Music`, `Play`, `Settings`, etc.)
- **AI Slop Violation:** ⚠️ Generic

---

### 4. Text Node

#### Color Palette
- **Node Title:** Yellow/Amber (`#92400e` light / `#fcd34d` dark) - warm tone
- **Background:** Customizable via `bgColor` property
- **AI Slop Violation:** ✅ None - clean design

#### Loading States
- No loading states (local editing)
- **Verdict:** ✅ N/A

#### Typography & Spacing
- Rich text editor with toolbar
- Resizable node
- **Verdict:** ✅ Clean, professional

#### Icons
- Lucide (`Type`)
- **AI Slop Violation:** ⚠️ Generic but acceptable

---

### 5. Media Node

#### Color Palette
- **Node Title:** Red (`#dc2626` light / `#F87171` dark)
- **AI Slop Violation:** ✅ None

#### Loading States
- Drag-and-drop zone
- Upload progress (external)
- **Verdict:** ✅ Clean

#### Icons
- Lucide (`Upload`, `Image`, `Link`)
- **Verdict:** ✅ Acceptable

---

## AI Slop Violations Summary

### ❌ Critical Violations

| Issue | Location | Description |
|-------|----------|-------------|
| Pulsing Glow Animation | `globals.css` | `animate-pulse-glow` creates purple neon glow during video generation |
| Pulsing Glow Animation | `globals.css` | `animate-pulse-glow-teal` creates teal neon glow during image generation |
| Glow Box Shadows | Node components | Generation buttons have colored shadows (`shadow-orange-500/20`) |

### ⚠️ Moderate Violations

| Issue | Location | Description |
|-------|----------|-------------|
| Saturated Category Colors | All generator nodes | Purple, teal, orange titles are highly saturated |
| Generic Icons | All nodes | Lucide React icons are overused in AI products |
| Rounded-2XL | All node cards | 16px border-radius is on the higher side |

### ✅ Passes

| Check | Status |
|-------|--------|
| Gradient backgrounds | ✅ No gradients in node cards |
| Rainbow colors | ✅ No rainbow effects |
| Too-round corners | ⚠️ borderline (rounded-2xl is acceptable) |
| Neon text effects | ✅ No neon text |
| Generic 3D effects | ✅ No 3D/perspective effects |

---

## Recommendations

### 1. Remove Pulsing Glow Animations (Critical)

The `animate-pulse-glow` and `animate-pulse-glow-teal` animations should be removed or replaced with subtle alternatives:

**Current (AI Slop):**
```css
.animate-pulse-glow {
  animation: pulse-glow 2s ease-in-out infinite;
}
```

**Recommended (Minimal):**
```css
.animate-pulse-glow {
  animation: pulse-subtle 2s ease-in-out infinite;
}

@keyframes pulse-subtle {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.85; }
}
```

### 2. Desaturate Category Colors

Consider softer tones for node titles:
- Video: `#6366f1` (indigo-500) instead of `#7c3aed`
- Image: `#0d9488` (teal-600) instead of `#0f766e`
- Music: `#f97316` (orange-500) - acceptable, or `#c2410c`

### 3. Reduce Border Radius

Consider `rounded-xl` (12px) instead of `rounded-2xl` (16px) for a more refined look.

### 4. Replace Generic Icons

Consider custom icon set or a less common library if rebranding is an option.

---

## Conclusion

The Koda canvas nodes have a solid foundation with clean layouts and good UX patterns. The primary AI slop violations are the **pulsing glow animations** during content generation, which create an overly flashy "AI is working" aesthetic. These should be replaced with subtle state indicators (e.g., opacity pulse or simple border color change) to align with modern minimalist design principles.

**Overall AI Slop Score:** 6/10 (Moderate)
- Static design: 3/10 (Good)
- Loading states: 8/10 (Needs improvement)
- Iconography: 5/10 (Acceptable)
- Color choices: 6/10 (Saturated but not extreme)
