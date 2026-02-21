# SPEC-003: Animated Card Hover Borders

## 1. ID & Title
- **ID**: SPEC-003
- **Title**: Animated Card Hover Borders (Gradient Border Animation)
- **Status**: Draft
- **Priority**: High
- **Created**: 2026-02-21

## 2. User Intent
**Primary User Goal**: Experience premium, interactive card surfaces that provide clear visual feedback on hover, making the interface feel more responsive and polished.

**User Stories**:
- As a user, I want cards to have a subtle, elegant border animation on hover to indicate interactivity
- As a designer, I want consistent hover states across all dashboard cards
- As a developer, I want a reusable component that doesn't impact performance

**Problem Being Solved**: Static card hover states feel flat and uninspiring. Animated gradient borders add a premium feel without being distracting.

## 3. Architectural Requirements

### Technical Implementation
**Approach**: CSS conic-gradient + mask for gradient border effect

```css
/* Base card style */
.card-interactive {
  position: relative;
  background: white;
  border-radius: 12px;
}

/* Gradient border via pseudo-element */
.card-interactive::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  padding: 1px;
  background: linear-gradient(135deg, #F59E0B, #EC4899);
  -webkit-mask: 
    linear-gradient(#fff 0 0) content-box, 
    linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.card-interactive:hover::before {
  opacity: 1;
}
```

**Alternative: Moving Gradient Border**
```css
.card-gradient-border {
  position: relative;
  background: linear-gradient(white, white) padding-box,
              linear-gradient(135deg, #F59E0B, #EC4899) border-box;
  border: 2px solid transparent;
  border-radius: 12px;
}
```

### Implementation Requirements

1. **Component Architecture**:
   - Create reusable `GradientBorderCard` component
   - Support contained (interactive) and static variants
   - Support disabled state (no animation)

2. **Animation Specs**:
   - Opacity transition: 0 → 1 over 300ms ease
   - OR gradient rotation: 0° → 360° over 3s (infinite on hover)
   - Easing: cubic-bezier(0.4, 0, 0.2, 1)

3. **Tailwind Integration**:
   - Extend theme with animation utilities
   - Create custom utility classes

### File Changes
- `tailwind.config.js`: Animation keyframes
- `globals.css`: Gradient border styles
- Component: `GradientBorderCard.tsx`

## 4. UI/UX Requirements

### Visual Specifications

| Property | Value |
|----------|-------|
| Border Radius | 12px (cards), 16px (large cards) |
| Border Width | 1px (subtle), 2px (standard) |
| Gradient Angle | 135deg (bottom-left to top-right) |
| Colors | Amber #F59E0B → Pink #EC4899 |
| Animation Duration | 300ms (fade), 3s (rotation) |

### Component Usage

```tsx
// Basic usage
<GradientBorderCard>
  <CardContent />
</GradientBorderCard>

// With hover animation
<GradientBorderCard animateOnHover>
  <CardContent />
</GradientBorderCard>

// Static (always visible border)
<GradientBorderCard variant="static">
  <CardContent />
</GradientBorderCard>

// Disabled (no border)
<GradientBorderCard disabled>
  <CardContent />
</GradientBorderCard>
```

### Contexts Where to Use
- **Dashboard cards**: Project cards, analytics widgets, recent activity
- **Feature cards**: Onboarding, help center, settings sections
- **Navigation cards**: Quick actions, shortcuts
- **NOT for**: Forms, tables, lists (use subtle hover instead)

### Performance Considerations
- Use `will-change: opacity, transform` sparingly
- Maximum 10 animated cards visible at once
- Respect `prefers-reduced-motion`

## 5. Definition of Done (DoD)

### Must Have
- [ ] Reusable GradientBorderCard component created
- [ ] Fade-in animation on hover (300ms)
- [ ] Gradient uses amber→pink colors per SPEC-002
- [ ] Works on both light and dark backgrounds
- [ ] Respects prefers-reduced-motion
- [ ] 12px border radius applied

### Visual Checkpoints
- [ ] Dashboard project cards have animated border on hover
- [ ] Analytics widgets show gradient border on hover
- [ ] Quick action cards animate on hover
- [ ] Border is smooth, no jagged edges
- [ ] Animation feels responsive, not laggy

### Accessibility Checkpoints
- [ ] Works with keyboard navigation (focus = hover state)
- [ ] Respects prefers-reduced-motion
- [ ] Focus-visible shows border for keyboard users
- [ ] No flashing/blinking effects

### Performance Checkpoints
- [ ] No jank on scroll
- [ ] 60fps animations
- [ ] Lighthouse performance > 90
