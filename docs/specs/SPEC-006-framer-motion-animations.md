# SPEC-006: Framer Motion Animations

## 1. ID & Title
- **ID**: SPEC-006
- **Title**: Framer Motion Animations (Page Transitions, Staggered Lists, Micro-interactions)
- **Status**: Draft
- **Priority**: High
- **Created**: 2026-02-21

## 2. User Intent
**Primary User Goal**: Experience a polished, fluid interface with smooth animations that enhance usability without being distracting.

**User Stories**:
- As a user, I want page transitions to feel smooth and connected
- As a user, I want list items to animate in sequentially for better comprehension
- As a user, I want interactive elements to provide satisfying feedback

**Problem Being Solved**: Static interfaces feel lifeless. Proper animations guide users, provide feedback, and create delight. Currently缺少动画让界面显得平淡无奇。

## 3. Architectural Requirements

### Technology Stack
- **Library**: Framer Motion (framer.com/motion)
- **Installation**: `npm install framer-motion`
- **Version**: Latest stable (v11+)
- **React**: Compatible with React 18+

### Dependencies
```bash
npm install framer-motion
```

### Animation Categories

1. **Page Transitions**: Route changes with smooth fades/slides
2. **Staggered Lists**: Sequential reveal of list items
3. **Micro-interactions**: Button hovers, clicks, toggles
4. **Modal/Dialog**: Enter/exit animations
5. **Scroll Animations**: Elements animate into view

### Implementation Requirements

1. **AnimatePresence Setup**:
   ```tsx
   // In root layout or template
   import { AnimatePresence, motion } from 'framer-motion';
   
   <AnimatePresence mode="wait">
     <motion.div
       key={pathname}
       initial={{ opacity: 0, y: 8 }}
       animate={{ opacity: 1, y: 0 }}
       exit={{ opacity: 0, y: -8 }}
       transition={{ duration: 0.2 }}
     >
       {children}
     </motion.div>
   </AnimatePresence>
   ```

2. **Staggered Children**:
   ```tsx
   const containerVariants = {
     hidden: { opacity: 0 },
     show: {
       opacity: 1,
       transition: { staggerChildren: 0.05 }
     }
   };
   
   const itemVariants = {
     hidden: { opacity: 0, y: 10 },
     show: { opacity: 1, y: 0 }
   };
   ```

3. **Custom Hooks**:
   - `usePageTransition()` - For route animations
   - `useStaggeredList()` - For list animations
   - `useMicroInteraction()` - For button/toggle animations

### File Changes
- `app/template.tsx` or `app/layout.tsx`: Page transitions
- `components/`: Add motion to existing components
- Create `hooks/useAnimation.ts` (optional)
- `tailwind.config.js`: Extend with motion-safe values

## 4. UI/UX Requirements

### Animation Specifications

#### Page Transitions
| Property | Value |
|----------|-------|
| Type | Fade + subtle slide |
| Duration | 200ms |
| Easing | `[0.4, 0, 0.2, 1]` (ease-out) |
| Direction | Up (enter), Down (exit) |

#### Staggered Lists
| Property | Value |
|----------|-------|
| Stagger | 50ms between items |
| Item Duration | 300ms |
| Item Easing | `[0.4, 0, 0.2, 1]` |
| Initial State | opacity: 0, y: 10 |
| Final State | opacity: 1, y: 0 |

#### Micro-interactions
| Element | Animation | Duration |
|---------|-----------|----------|
| Buttons | scale(0.97) on tap | 100ms |
| Buttons | scale(1.05) on hover | 200ms |
| Toggles | spring bounce | 300ms |
| Cards | subtle lift on hover | 200ms |
| Inputs | border glow on focus | 150ms |
| Icons | rotate/scale on action | 200ms |

#### Modal/Dialog
| Property | Value |
|----------|-------|
| Backdrop | fade in 200ms |
| Content | scale(0.95) → scale(1) + fade |
| Duration | 200ms |
| Exit | reverse of enter |

### Reduced Motion
- Must respect `prefers-reduced-motion`
- Provide instant (0ms) fallback for users who prefer it
- No bouncing, flashing, or parallax effects for reduced-motion users

### Performance Guidelines
- Use `layout` prop sparingly (can cause re-renders)
- Prefer `transform` over `left/top` for animations
- Use `will-change` strategically
- Maximum 20 animated elements on single view

## 5. UI/UX Requirements (Detailed)

### Page Transition Examples

**Dashboard → Project**:
```
Enter: Fade in + slide up 8px (200ms)
Exit: Fade out + slide down 8px (200ms)
```

**Dashboard → Settings**:
```
Enter: Fade in + slide right 20px (200ms)
Exit: Fade out + slide left 20px (200ms)
```

### Staggered List Examples

**Project Cards**:
- Container: `staggerChildren: 0.05`
- Card: Fade in + translateY 10px → 0
- Trigger: On mount

**Dashboard Widgets**:
- Container: `staggerChildren: 0.1`
- Widget: Scale 0.95 + fade → 1 + fade
- Trigger: When in viewport (optional)

### Micro-interaction Examples

**Primary Button**:
```tsx
<motion.button
  whileHover={{ scale: 1.02 }}
  whileTap={{ scale: 0.98 }}
  transition={{ type: "spring", stiffness: 400 }}
>
```

**Card Hover**:
```tsx
<motion.div
  whileHover={{ y: -4, boxShadow: "0 12px 24px rgba(0,0,0,0.1)" }}
  transition={{ duration: 0.2 }}
>
```

**Toggle Switch**:
```tsx
<motion.div
  animate={{ x: isOn ? 20 : 0 }}
  transition={{ type: "spring", stiffness: 500, damping: 30 }}
/>
```

## 6. Definition of Done (DoD)

### Must Have
- [ ] Framer Motion installed and working
- [ ] Page transitions on route changes
- [ ] Staggered animations for lists
- [ ] Button hover/tap animations
- [ ] Card hover animations
- [ ] Modal/dialog animations
- [ ] Respects prefers-reduced-motion
- [ ] All animations 60fps

### Visual Checkpoints
- [ ] Dashboard cards animate in sequence
- [ ] Page navigation has smooth transition
- [ ] Buttons have satisfying press effect
- [ ] Cards lift on hover
- [ ] No animation jank or stuttering
- [ ] Modals animate smoothly

### Accessibility Checkpoints
- [ ] prefers-reduced-motion respected
- [ ] No flashing/blinking
- [ ] Animations don't trigger vestibular issues
- [ ] Focus not disrupted by animations

### Performance Checkpoints
- [ ] Lighthouse performance > 90
- [ ] No jank on mid-range devices
- [ ] No layout thrashing
- [ ] Animations use transform/opacity only
