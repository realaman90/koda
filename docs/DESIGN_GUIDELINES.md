# Koda Design Guidelines

## Philosophy
**"Boring but beautiful"** - Clean, professional, humanistic. No AI slop.

Reference: Linear, Vercel, Stripe - minimal, refined, functional.

---

## Color Palette

### Core Colors (No Gradients)
```css
/* Background */
--bg-primary: #0a0a0a;      /* Deep black */
--bg-secondary: #141414;     /* Card backgrounds */
--bg-tertiary: #1a1a1a;      /* Elevated surfaces */

/* Borders */
--border-subtle: rgba(255, 255, 255, 0.06);
--border-default: rgba(255, 255, 255, 0.1);
--border-focus: rgba(255, 255, 255, 0.2);

/* Text */
--text-primary: #ffffff;
--text-secondary: #a1a1aa;
--text-tertiary: #71717a;

/* Accent - Single Color Only */
--accent: #3b82f6;           /* Blue-500 - refined, not flashy */
--accent-hover: #2563eb;      /* Blue-600 */
```

### Why Not Gradient?
- Gradients = AI slop
- Single solid colors = professional, trustworthy
- Blue is standard for tech (Stripe, Vercel use blue)

---

## Typography

### Font Stack
- **Headings**: Instrument Serif (elegant, distinctive)
- **Body**: Geist Sans (clean, readable)
- **Mono**: Geist Mono (code)

### Scale
| Element | Size | Weight |
|---------|------|--------|
| H1 | 2.5rem (40px) | 400 |
| H2 | 2rem (32px) | 400 |
| H3 | 1.5rem (24px) | 400 |
| Body | 1rem (16px) | 400 |
| Small | 0.875rem (14px) | 400 |

---

## Buttons

### Primary Button
```tsx
// Clean, solid color - no gradient
<Button className="
  bg-[#3b82f6] 
  hover:bg-[#2563eb]
  text-white
  px-4 py-2
  rounded-lg
  font-medium
  transition-colors
">
  Primary
</Button>
```

### Secondary Button
```tsx
<Button variant="outline" className="
  border border-[rgba(255,255,255,0.1)]
  hover:border-[rgba(255,255,255,0.2)]
  hover:bg-[rgba(255,255,255,0.05)]
">
  Secondary
</Button>
```

### Ghost Button
```tsx
<Button variant="ghost" className="
  hover:bg-[rgba(255,255,255,0.05)]
  text-[#a1a1aa]
  hover:text-white
">
  Ghost
</Button>
```

### Rules
- ❌ NO gradients
- ❌ NO animated borders
- ❌ NO glowing effects
- ✅ Subtle hover states
- ✅ Focus rings for accessibility

---

## Cards

### Dashboard Card
```tsx
<div className="
  bg-[#141414]
  border border-[rgba(255,255,255,0.06)]
  rounded-xl
  p-4
  hover:border-[rgba(255,255,255,0.1)]
  transition-colors
">
  {/* Content */}
</div>
```

### Rules
- Subtle border, not heavy shadow
- Minimal hover effect (border color only)
- No gradient backgrounds
- No fancy animations on hover

---

## Canvas Nodes

### Node Style
- Solid background (#1a1a1a)
- 1px subtle border
- No gradient borders
- Minimal toolbar on hover

### Node Card
```tsx
<div className="
  bg-[#1a1a1a]
  border border-[rgba(255,255,255,0.08)]
  rounded-lg
  overflow-hidden
">
  {/* Preview */}
  <div className="p-3">
    {/* Content */}
  </div>
</div>
```

---

## Interactions

### Hover States
- Background: slight lighten
- Border: subtle increase in opacity
- NO scale animations (too flashy)
- NO gradient reveals

### Focus States
- Visible focus ring: `ring-2 ring-blue-500/50`
- Essential for accessibility

### Loading States
- Simple spinner (no gradient animation)
- Or skeleton with subtle pulse

---

## What NOT To Use

| Avoid | Reason |
|-------|--------|
| Gradient buttons | AI slop |
| Animated borders | Distracting |
| Glowing effects | Unprofessional |
| FAB (Floating Action Button) | Overwhelming |
| Sparkle/AI icons | Generic AI look |
| Animated gradients | Flashy, not focused |

---

## Summary

**Do:**
- Single solid colors
- Subtle borders
- Clean typography
- Refined interactions
- Professional feel (Linear/Vercel style)

**Don't:**
- Gradients
- Flashy animations
- AI aesthetics
- Over-designed elements

Keep it simple. Keep it focused.
