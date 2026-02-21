# SPEC-001: Instrument Serif Typography Upgrade

## 1. ID & Title
- **ID**: SPEC-001
- **Title**: Instrument Serif Typography Upgrade
- **Status**: Draft
- **Priority**: High
- **Created**: 2026-02-21

## 2. User Intent
**Primary User Goal**: Improve visual hierarchy and brand identity by introducing a sophisticated serif display font for headings while maintaining excellent readability for body text.

**User Stories**:
- As a user, I want headings to feel distinctive and premium so the application feels more polished
- As a user, I want body text to remain clean and highly readable for extended reading
- As a designer, I want a clear typographic hierarchy that guides the eye through content

**Problem Being Solved**: The current all-sans-serif typography lacks visual distinction and doesn't reflect the premium, creative nature of the Koda product.

## 3. Architectural Requirements

### Technology Stack
- **Font Loading**: Google Fonts or self-hosted woff2 files
- **Font**: Instrument Serif (display serif), Geist Sans (body - already in use)
- **CSS Approach**: CSS custom properties for font families
- **Next.js/Tailwind**: Compatible with existing stack

### Implementation Requirements
1. **Font Import Strategy**:
   - Use `next/font` or Google Fonts for optimal loading
   - Implement font-display: swap for performance
   - Preload critical font weights

2. **CSS Architecture**:
   ```css
   :root {
     --font-display: 'Instrument Serif', Georgia, serif;
     --font-body: 'Geist Sans', -apple-system, sans-serif;
   }
   ```

3. **Performance Constraints**:
   - Font files must be woff2 only
   - Total font bundle increase < 50KB
   - No layout shift (CLS < 0.1)

### File Changes
- Update `tailwind.config.js` with font families
- Update global CSS/root variables
- Create typography utility classes

## 4. UI/UX Requirements

### Typography Scale
| Element | Font | Weight | Size (Desktop) | Size (Mobile) |
|---------|------|--------|----------------|---------------|
| H1 | Instrument Serif | 400 | 48px / 3rem | 32px / 2rem |
| H2 | Instrument Serif | 400 | 36px / 2.25rem | 28px / 1.75rem |
| H3 | Instrument Serif | 400 | 28px / 1.75rem | 24px / 1.5rem |
| H4 | Instrument Serif | 400 | 22px / 1.375rem | 20px / 1.25rem |
| Body | Geist Sans | 400/500 | 16px / 1rem | 16px / 1rem |
| Small | Geist Sans | 400 | 14px / 0.875rem | 14px / 0.875rem |
| Caption | Geist Sans | 500 | 12px / 0.75rem | 12px / 0.75rem |

### Visual Design
- **Heading Color**: `text-gray-900` (primary), `text-gray-700` (secondary)
- **Body Color**: `text-gray-600` (primary), `text-gray-500` (secondary)
- **Line Heights**: Headings 1.2, Body 1.6, Small 1.5
- **Letter Spacing**: Headings -0.02em, Body 0

### Usage Guidelines
1. **H1**: Page titles, hero sections
2. **H2**: Section headings, major divisions
3. **H3**: Subsection headings, card titles
4. **H4**: Small section headings, component titles
5. **Body**: Paragraphs, descriptions, content
6. **Small**: Secondary info, metadata
7. **Caption**: Labels, timestamps, hints

### Responsive Behavior
- Scale typography down at breakpoints (mobile: 640px, tablet: 768px)
- Maintain typographic hierarchy at all sizes
- Touch targets remain minimum 44px

## 5. Definition of Done (DoD)

### Must Have
- [ ] Instrument Serif font loaded and working
- [ ] All H1-H4 elements use Instrument Serif
- [ ] All body text uses Geist Sans
- [ ] Typography scale implemented per spec
- [ ] Responsive typography at all breakpoints
- [ ] No layout shift on font load
- [ ] Accessibility: sufficient contrast ratios maintained

### Visual Checkpoints
- [ ] Homepage hero heading uses Instrument Serif
- [ ] Dashboard page titles use Instrument Serif
- [ ] Card titles and section headings use Instrument Serif
- [ ] Body text remains in Geist Sans
- [ ] No fallback font flash on load

### Performance Check ] Font filespoints
- [ are woff2 format
- [ ] Font-display: swap implemented
- [ ] Lighthouse performance score > 90
- [ ] CLS score < 0.1
