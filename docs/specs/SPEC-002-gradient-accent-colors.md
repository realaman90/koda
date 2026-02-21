# SPEC-002: Gradient Accent Colors

## 1. ID & Title
- **ID**: SPEC-002
- **Title**: Gradient Accent Colors (Amber → Pink)
- **Status**: Draft
- **Priority**: High
- **Created**: 2026-02-21

## 2. User Intent
**Primary User Goal**: Experience a warmer, more energetic visual identity that feels fresh and distinctive while maintaining accessibility.

**User Stories**:
- As a user, I want the interface to feel warm and inviting, not cold like the current purple
- As a brand, I want a unique color identity that differentiates Koda from competitors
- As a designer, I want consistent gradient accents that work across light and dark modes

**Problem Being Solved**: Current purple accent color feels generic and overused in the SaaS space. Amber→pink gradient feels more distinctive, creative, and energetic.

## 3. Architectural Requirements

### Color Palette Design
**Primary Gradient**: `linear-gradient(135deg, #F59E0B 0%, #EC4899 100%)`
- Amber (50-500): `#FEF3C7` to `#F59E0B`
- Pink (400-600): `#EC4899` to `#DB2777`

**CSS Custom Properties**:
```css
:root {
  /* Gradient Colors */
  --gradient-start: #F59E0B;  /* Amber 500 */
  --gradient-end: #EC4899;   /* Pink 500 */
  --gradient-main: linear-gradient(135deg, #F59E0B 0%, #EC4899 100%);
  
  /* Supporting Colors */
  --accent-amber: #F59E0B;
  --accent-pink: #EC4899;
  --accent-amber-light: #FCD34D;
  --accent-pink-light: #F9A8D4;
  
  /* Semantic Mappings */
  --primary: #F59E0B;
  --secondary: #EC4899;
}
```

### Implementation Requirements

1. **Tailwind Config Update**:
   - Add custom colors to `tailwind.config.js`
   - Extend `backgroundImage` with gradient utilities

2. **Component Updates**:
   - Primary buttons: Gradient background
   - Active states: Gradient border/glow
   - Focus rings: Gradient color
   - Loading spinners: Gradient animation
   - Links: Gradient text where appropriate

3. **Dark Mode**:
   - Adjust gradient stops for dark backgrounds
   - Ensure sufficient contrast (WCAG AA)

### File Changes
- `tailwind.config.js`: Add custom colors and gradients
- `globals.css`: CSS custom properties
- Component files: Update accent usage

## 4. UI/UX Requirements

### Usage Guidelines

| Context | Color/Treatment |
|---------|-----------------|
| Primary CTA | Gradient background (amber→pink) |
| Secondary CTA | White bg, gradient border |
| Active/Focus | Gradient ring/shadow |
| Links | Gradient text |
| Icons | Gradient fill |
| Badges | Gradient background |
| Loading | Gradient spinner |
| Highlights | Gradient underline |

### Gradient Variations
```css
/* Standard gradient */
.bg-gradient-accent { background: linear-gradient(135deg, #F59E0B 0%, #EC4899 100%); }

/* Subtle gradient (15% opacity) */
.bg-gradient-accent-subtle { background: linear-gradient(135deg, rgba(245,158,11,0.15) 0%, rgba(236,72,153,0.15) 100%); }

/* Dark mode gradient */
.bg-gradient-accent-dark { background: linear-gradient(135deg, #FBBF24 0%, #F472B6 100%); }
```

### Accessibility Requirements
- Text using gradient: Minimum contrast 4.5:1 with background
- Gradient buttons: Icon + text (not icon-only)
- Focus states: Visible gradient ring (minimum 2px)
- Color-blind friendly: Don't rely solely on gradient for meaning

### Animation
- Gradient angle: Subtle 3deg-5deg rotation on hover
- Transition: 200ms ease-out
- Optional: Slow ambient gradient animation (10s loop)

## 5. Definition of Done (DoD)

### Must Have
- [ ] Amber→pink gradient defined in CSS variables
- [ ] Tailwind config updated with custom colors
- [ ] Primary buttons use gradient
- [ ] Focus states use gradient ring
- [ ] Active states use gradient glow
- [ ] Dark mode gradient variants work
- [ ] Loading states use gradient

### Visual Checkpoints
- [ ] Hero section CTA has gradient
- [ ] Dashboard action buttons have gradient
- [ ] Navigation active states show gradient
- [ ] Form submit buttons use gradient
- [ ] Toast/notification accents use gradient
- [ ] Cards with hover show gradient highlights

### Accessibility Checkpoints
- [ ] All gradient text passes WCAG AA
- [ ] Gradient buttons have text labels
- [ ] Focus rings visible on all interactive elements
- [ ] Works in forced colors mode
- [ ] No information lost without gradient
