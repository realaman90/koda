# SPEC-004: Cmd+K Command Palette

## 1. ID & Title
- **ID**: SPEC-004
- **Title**: Cmd+K Command Palette (cmdk-based)
- **Status**: Draft
- **Priority**: High
- **Created**: 2026-02-21

## 2. User Intent
**Primary User Goal**: Quickly navigate, search, and execute actions across the application using keyboard shortcuts, improving efficiency and discoverability.

**User Stories**:
- As a power user, I want to press Cmd+K to open a command palette for quick navigation
- As a user, I want to search across pages, actions, and recent items
- As a user, I want keyboard-only workflow without mouse dependency

**Problem Being Solved**: Users need faster ways to navigate large applications. Current navigation requires multiple clicks. Command palette provides instant access to all features.

## 3. Architectural Requirements

### Technology Stack
- **Library**: cmdk (cmdk.vercel.app) - React command palette
- **Positioning**: @radix-ui/react-dialog or Floating UI
- **State**: React useState/useReducer
- **Keyboard**: Native keyboard events

### Dependencies
```bash
npm install cmdk
# or
pnpm add cmdk
```

### Command Structure
```tsx
interface CommandItem {
  id: string;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  shortcut?: string[];
  action: () => void;
  category: 'navigation' | 'actions' | 'recent' | 'settings';
}
```

### Implementation Requirements

1. **Global Keyboard Handler**:
   ```tsx
   // Listen for Cmd+K (Mac) / Ctrl+K (Windows)
   useEffect(() => {
     const handleKeyDown = (e: KeyboardEvent) => {
       if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
         e.preventDefault();
         setOpen(!open);
       }
       // Close on Escape
       if (e.key === 'Escape') setOpen(false);
     };
     window.addEventListener('keydown', handleKeyDown);
     return () => window.removeEventListener('keydown', handleKeyDown);
   }, []);
   ```

2. **Command Categories**:
   - **Navigation**: Go to pages (Dashboard, Projects, Settings, etc.)
   - **Actions**: Create new, Import, Export, etc.
   - **Recent**: Recently viewed projects, pages
   - **Settings**: Theme toggle, Keyboard shortcuts help

3. **Search Implementation**:
   - Local search through command items
   - Fuzzy matching support
   - Highlight matching text

### File Changes
- Create `components/CommandPalette.tsx`
- Add to `app/layout.tsx` or root layout
- Create `hooks/useCommandPalette.ts`
- Update `tailwind.config.js` for dialog styles

## 4. UI/UX Requirements

### Visual Design

| Property | Value |
|----------|-------|
| Width | 600px max, 90vw on mobile |
| Max Height | 400px |
| Border Radius | 12px |
| Shadow | `0 25px 50px -12px rgba(0,0,0,0.25)` |
| Backdrop | Blur 8px, dark overlay |
| Input Height | 48px |
| Item Padding | 12px 16px |

### Color Scheme (Dark)
- Background: `#1a1a1a` (or current surface)
- Input Text: `#ffffff`
- Secondary Text: `#a1a1aa`
- Selected Item: `rgba(245,158,11,0.1)` (amber tint)
- Accent: Amber→pink gradient for selected indicator

### Component Structure
```
┌─────────────────────────────────────────┐
│  🔍  Search commands...                 │
├─────────────────────────────────────────┤
│  Navigation                             │
│  ┌─────────────────────────────────────┐│
│  │ 🏠  Go to Dashboard                 ││
│  │ 📁  Go to Projects                  ││
│  │ ⚙️  Go to Settings                  ││
│  └─────────────────────────────────────┘│
│  Actions                                │
│  ┌─────────────────────────────────────┐│
│  │ ➕  Create New Project      ⌘N      ││
│  │ 📥  Import Project          ⌘I     ││
│  │ 📤  Export Data             ⌘E     ││
│  └─────────────────────────────────────┘│
│  Recent                                 │
│  ┌─────────────────────────────────────┐│
│  │ 🕐  Project Alpha                    ││
│  │ 🕐  Recent Canvas                   ││
│  └─────────────────────────────────────┘│
└─────────────────────────────────────────┘
```

### Keyboard Navigation
- `↑` / `↓`: Navigate items
- `Enter`: Execute selected command
- `Escape`: Close palette
- `Cmd+K`: Toggle palette
- `Ctrl+K`: Toggle (Windows)

### Mobile Behavior
- Full screen on mobile
- Bottom sheet style
- Large touch targets (48px min)

### Accessibility
- Focus trap when open
- ARIA attributes (role="dialog", aria-modal)
- Screen reader announcements
- Keyboard-only navigation

## 5. Definition of Done (DoD)

### Must Have
- [ ] Cmd+K (Mac) / Ctrl+K (Windows) opens palette
- [ ] Escape closes palette
- [ ] Search filters commands in real-time
- [ ] Arrow keys navigate commands
- [ ] Enter executes selected command
- [ ] Backdrop click closes palette
- [ ] Commands categorized (Navigation, Actions, Recent)

### Visual Checkpoints
- [ ] Palette appears centered on screen
- [ ] Backdrop has blur effect
- [ ] Selected item has visible highlight
- [ ] Icons display correctly
- [ ] Keyboard shortcuts shown
- [ ] Mobile: full screen bottom sheet

### Accessibility Checkpoints
- [ ] Focus trapped in dialog
- [ ] Escape key works
- [ ] Screen reader announces open/close
- [ ] Selected item announced
- [ ] Tab order correct
- [ ] Respects prefers-reduced-motion

### Functional Checkpoints
- [ ] Navigation commands work (go to pages)
- [ ] Action commands work (create, import, export)
- [ ] Recent items show history
- [ ] Search finds commands by title
- [ ] Keyboard shortcuts displayed
- [ ] Works offline
