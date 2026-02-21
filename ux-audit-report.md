# KODA (spaces-clone) - UX Audit Report

**Date:** 2026-02-21  
**Auditor:** Designer Subagent  
**App Version:** 0.1.0 (Next.js 16.1.1)  
**URLs Tested:** http://localhost:3000 (port 3000)

---

## Executive Summary

KODA is a visual storyboard/canvas application with a modern tech stack (Next.js 16, Tailwind CSS v4, React Flow for canvas). The design system shows good foundational work with comprehensive theming support, but has several UI/UX issues that need attention.

**Overall Assessment:** 6.5/10 - Functional but needs polish

---

## Screenshots Captured

| Page | Path | Screenshot |
|------|------|------------|
| Dashboard/Home | `/` | `bb31e00b-8c3c-4ab6-bdf9-2998d6eefee0.png` |
| Templates | `/?tab=templates` | `fa532b81-5f74-4af4-83c8-e38d067e9e1b.png` |
| Settings | `/settings` | `60c3be17-d301-40ae-869e-188c1b7bb87a.png` |

---

## Design System Analysis

### Color Palette ✅

**Light Mode:**
| Role | Color | Usage |
|------|-------|-------|
| Primary Accent | `#7C3AED` (violet) | CTAs, active states |
| Accent Hover | `#6D28D9` | Button hovers |
| Background | `oklch(1 0 0)` | Page background |
| Foreground | `oklch(0.145 0 0)` | Primary text |
| Border | `oklch(0.922 0 0)` | Dividers, inputs |

**Dark Mode:**
- Properly inverted with OKLCH color space
- Good contrast ratios maintained

**Strengths:**
- Modern OKLCH color space usage
- Comprehensive CSS variable system
- Node-specific color coding (text=amber, image=teal, video=purple, etc.)

### Typography ✅

- **Primary Font:** Geist Sansvar (`(--font-geist-sans)`)
- **Monospace:** Geist Mono (`var(--font-geist-mono)`)
- Proper heading hierarchy (h1-h3)
- Good line-height and spacing

### Spacing & Layout

- Consistent 12-column grid approach
- Card-based layouts with proper padding
- Sidebar navigation pattern well-implemented

---

## Page-by-Page Audit

### 1. Dashboard (Home) - `/`

**Screenshot:** `bb31e00b-8c3c-4ab6-bdf9-2998d6eefee0.png`

#### Issues Found:

| # | Issue | Severity | Description |
|---|-------|----------|-------------|
| 1.1 | **Button alignment** | 🔴 High | "New project" button has icon floating above text - not vertically centered |
| 1.2 | **Project card spacing** | 🟡 Medium | Project cards have inconsistent internal spacing |
| 1.3 | **Missing timestamp formatting** | 🟡 Medium | Shows "56m ago" - should be more human-readable (e.g., "56 minutes ago") |
| 1.4 | **Empty state icon** | 🟢 Low | The emoji 🖼️ as project thumbnail is a placeholder, not ideal |
| 1.5 | **Navigation state** | 🟡 Medium | "Projects" tab shows "Your projects" but visual active state unclear |

#### Positive Observations:
- Clean hero section with clear CTA
- Showcase section well-presented with thumbnails
- Tab navigation (My projects / Shared / Showcase) is functional

---

### 2. Templates Page - `/?tab=templates`

**Screenshot:** `fa532b81-5f74-4af4-83c8-e38d067e9e1b.png`

#### Issues Found:

| # | Issue | Severity | Description |
|---|-------|----------|-------------|
| 2.1 | **Content loading** | 🔴 High | Templates grid is empty - no template cards visible |
| 2.2 | **Loading state** | 🟡 Medium | No skeleton loaders or loading indicators |
| 2.3 | **Empty state** | 🟡 Medium | Missing empty state message if templates genuinely unavailable |

#### Positive Observations:
- Navigation highlights correctly
- Page structure is sound

---

### 3. Settings Page - `/settings`

**Screenshot:** `60c3be17-d301-40ae-869e-188c1b7bb87a.png`

#### Issues Found:

| # | Issue | Severity | Description |
|---|-------|----------|-------------|
| 3.1 | **Theme toggle missing** | 🔴 High | No visible dark/light mode toggle |
| 3.2 | **Settings content** | 🟡 Medium | Only shows "User settings" heading with minimal content |
| 3.3 | **Form fields** | 🟡 Medium | Placeholder only - actual form fields not implemented |

#### Positive Observations:
- Settings page structure exists
- Navigation works correctly

---

### 4. Canvas (Tested but failed)

**URL:** `/canvas/[id]`

| # | Issue | Severity | Description |
|---|-------|----------|-------------|
| 4.1 | **Canvas not found** | 🔴 High | Tested existing canvas - got "Canvas not found" error |
| 4.2 | **Error handling** | 🟡 Medium | Generic error message, no option to create new canvas |

---

## Component Consistency Analysis

### ✅ Well-Consistent Components:
1. **Navigation sidebar** - Consistent icon + text pattern
2. **Page headers** - Consistent h2 hierarchy
3. **Card components** - Consistent border-radius (0.75rem / 12px)
4. **Buttons** - Consistent hover states with `--accent-primary-hover`

### ❌ Inconsistent Components:
1. **Icon buttons** - Some have icons above text, others beside
2. **Form inputs** - Inconsistent focus ring colors
3. **Navigation tabs** - Active state not visually distinct enough

---

## Accessibility Issues

| # | Issue | WCAG | Description |
|---|-------|------|-------------|
| A1 | **Focus indicators** | AA | Some interactive elements lack visible focus rings |
| A2 | **Color contrast** | AA | Some muted text (`--muted-foreground: oklch(0.556 0 0)`) may not meet 4.5:1 ratio |
| A3 | **Keyboard navigation** | AA | Cannot fully navigate without mouse (canvas especially) |
| A4 | **Screen reader** | A | Some icons lack aria-labels |

---

## Recommendations (Priority Order)

### 🔴 High Priority:

1. **Fix button alignment** - Center icon and text vertically in all buttons
   ```css
   /* Add to button styles */
   display: flex;
   align-items: center;
   justify-content: center;
   gap: 8px;
   ```

2. **Implement Templates page** - Add actual template cards or proper loading/empty states

3. **Add dark/light mode toggle** - Place in header or settings page

4. **Fix canvas routing** - Ensure valid canvas IDs or provide better error handling with "Create New" option

### 🟡 Medium Priority:

5. **Improve empty states** - Add illustrations and helpful messages for empty content areas

6. **Add loading skeletons** - Show skeleton loaders during data fetch

7. **Enhance navigation active states** - Make current tab more visually distinct

8. **Improve timestamp formatting** - Use full words ("56 minutes ago" not "56m ago")

### 🟢 Low Priority:

9. **Add keyboard shortcuts** - Document and implement (e.g., "alt+T" for notifications shown in UI)

10. **Improve error pages** - Add helpful actions on error states (e.g., "Go to Dashboard" button)

11. **Add tooltips** - Provide hover tooltips for icon-only buttons

---

## Technical Notes

### Stack Identified:
- **Framework:** Next.js 16.1.1 (Turbopack)
- **Styling:** Tailwind CSS v4 + custom CSS variables
- **State:** Zustand
- **Database:** SQLite (better-sqlite3) with Drizzle ORM
- **AI:** Anthropic SDK + Mastra
- **Canvas:** @xyflow/react (React Flow)
- **Editor:** TipTap (rich text)
- **UI Components:** Radix UI primitives
- **Icons:** Lucide React

### CSS Architecture:
- Comprehensive CSS custom properties system
- Light/dark mode via `.dark` class
- Component-scoped variables (e.g., `--node-card-bg`, `--an-bg`)
- Animations via CSS keyframes (shimmer, pulse-glow, bloom)

---

## Conclusion

KODA has a solid foundation with modern tooling and a well-structured design system. The main issues are functional gaps (missing templates, broken canvas routing, no theme toggle) rather than fundamental design flaws. Addressing the high-priority items will significantly improve the user experience.

**Next Steps:**
1. Fix button alignment across all components
2. Implement missing page content (templates, settings forms)
3. Add theme toggle
4. Improve error handling and empty states

---

*Report generated by Designer Subagent - 2026-02-21*
