# SPEC-005: Floating Action Button (FAB) for AI Assist

## 1. ID & Title
- **ID**: SPEC-005
- **Title**: FAB for AI Assist
- **Status**: Draft
- **Priority**: High
- **Created**: 2026-02-21

## 2. User Intent
**Primary User Goal**: Access AI assistance quickly while working in the canvas workspace without interrupting workflow.

**User Stories**:
- As a user, I want an AI assistant button always visible in the canvas workspace
- As a user, I want one-click access to AI help without leaving my current context
- As a designer, I want a non-intrusive but easily discoverable AI entry point

**Problem Being Solved**: AI features exist but require navigating through menus or leaving the canvas. A floating action button provides constant, frictionless access to AI assistance.

## 3. Architectural Requirements

### Technology Stack
- **Position**: Fixed positioning with z-index
- **Animation**: Framer Motion (as per SPEC-006)
- **State**: React useState for open/closed
- **Icons**: Lucide React or existing icon set

### Component Structure
```tsx
interface FABProps {
  onClick: () => void;
  isOpen?: boolean;
  position?: 'bottom-right' | 'bottom-center';
  size?: 'default' | 'large';
  label?: string;
}
```

### Implementation Requirements

1. **Fixed Positioning**:
   ```css
   .fab-container {
     position: fixed;
     bottom: 24px;
     right: 24px;
     z-index: 50;
   }
   ```

2. **Trigger Behavior**:
   - Click: Opens AI assist panel/sidebar
   - Long press (mobile): Alternative trigger
   - Keyboard: Focusable, Enter/Space activates

3. **AI Panel Integration**:
   - Opens as sidebar or bottom sheet
   - Contains AI chat/assist interface
   - Dismissible by clicking outside or X button

### File Changes
- Create `components/FloatingActionButton.tsx`
- Create `components/AIAssistPanel.tsx`
- Update canvas workspace layout
- Add to global layout (canvas routes only)

## 4. UI/UX Requirements

### Visual Design

| Property | Value |
|----------|-------|
| Button Size | 56px diameter (default), 64px (large) |
| Icon Size | 24px |
| Border Radius | Full (50%) |
| Shadow | `0 4px 20px rgba(245,158,11,0.4)` (amber glow) |
| Position | 24px from bottom, 24px from right |
| Mobile Position | 16px from bottom, 16px from right |

### Color & Gradient
- **Default**: Gradient background (amber→pink per SPEC-002)
- **Hover**: Scale 1.1, increased shadow
- **Active/Pressed**: Scale 0.95
- **Focus**: Gradient ring (2px)
- **Disabled**: Grayed out, no shadow

### Icon
- Sparkles/Stars icon (`<Sparkles />` from Lucide)
- White icon color
- Optional: Animated sparkles on idle

### Component States

| State | Visual |
|-------|--------|
| Default | Gradient bg, subtle shadow, sparkles icon |
| Hover | Scale 1.1, stronger shadow, slight rotation |
| Active | Scale 0.95, darker gradient |
| Focus | 2px gradient ring |
| Loading | Pulsing animation |
| Disabled | Gray bg, no shadow |

### Animation (Framer Motion)
```tsx
<motion.button
  initial={{ scale: 0, opacity: 0 }}
  animate={{ scale: 1, opacity: 1 }}
  whileHover={{ scale: 1.1 }}
  whileTap={{ scale: 0.95 }}
  transition={{ type: "spring", stiffness: 400 }}
>
```

### Mobile Behavior
- Larger touch target (64px)
- Position: bottom-center (more thumb-friendly)
- Bottom sheet for AI panel
- Swipe down to dismiss panel

### Accessibility
- `aria-label="Open AI Assistant"`
- `aria-expanded` state
- Keyboard navigable (Tab to focus, Enter to activate)
- Focus visible ring
- Screen reader announcement on open

### Panel Design (AI Assist)
```
┌────────────────────────────────────┐
│  ✨ AI Assistant            ✕     │
├────────────────────────────────────┤
│  Hi! How can I help you today?    │
│                                    │
│  ┌──────────────────────────────┐  │
│  │  Suggest layout ideas        │  │
│  │  Help with design            │  │
│  │  Write copy for this canvas  │  │
│  └──────────────────────────────┘  │
│                                    │
│  ┌──────────────────────────────┐  │
│  │ Type your message...    Send │  │
│  └──────────────────────────────┘  │
└────────────────────────────────────┘
```

### Context Visibility
- Show FAB on: Canvas workspace, Editor pages
- Hide FAB on: Settings, Auth pages, Landing
- FAB should NOT block content interaction

## 5. Definition of Done (DoD)

### Must Have
- [ ] FAB button visible on canvas workspace
- [ ] Clicking opens AI assist panel/sidebar
- [ ] Gradient styling (amber→pink) per SPEC-002
- [ ] Hover animation (scale + shadow)
- [ ] Click animation (press effect)
- [ ] Keyboard accessible (Tab + Enter)
- [ ] Focus visible ring

### Visual Checkpoints
- [ ] FAB appears in bottom-right corner
- [ ] Gradient background visible
- [ ] Sparkles icon centered
- [ ] Shadow creates floating effect
- [ ] Animation is smooth (60fps)
- [ ] Mobile: proper sizing and position

### Accessibility Checkpoints
- [ ] aria-label present
- [ ] Keyboard navigable
- [ ] Focus ring visible
- [ ] Works with screen reader
- [ ] Respects prefers-reduced-motion

### Functional Checkpoints
- [ ] Opens AI panel on click
- [ ] Closes on X button
- [ ] Closes on backdrop click
- [ ] Closes on Escape key
- [ ] Shows loading state
- [ ] Hidden on non-canvas routes
