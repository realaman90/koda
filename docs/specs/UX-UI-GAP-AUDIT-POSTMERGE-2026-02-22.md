# UX/UI GAP AUDIT (POST-MERGE) — 2026-02-22

## Scope
Post-merge UX/UI audit of auth entry, dashboard tabs, settings (profile + invites), canvas shell, and account dropdown.

Audit basis:
- Live UI walkthrough + captured screenshots
- Component/API review for affected flows in `src/components/**`, `src/app/**`, `src/lib/**`, `src/stores/**`

---

## 1) Screenshot Index

All screenshots stored under:
`docs/screenshots/postmerge-ux-ui-gap-audit-2026-02-22/`

1. **Sign-in**  
   `01-sign-in.png`
2. **Sign-up**  
   `02-sign-up.png`
3. **Dashboard (My projects tab)**  
   `03-dashboard-my-projects.png`
4. **Dashboard (Shared tab)**  
   `04-dashboard-shared-tab.png`
5. **Dashboard (Showcase tab)**  
   `05-dashboard-showcase-tab.png`
6. **Settings (Profile)**  
   `06-settings-profile.png`
7. **Settings (Invites)**  
   `07-settings-invites.png`
8. **Canvas shell**  
   `08-canvas-shell.png`
9. **Account dropdown**  
   `09-account-dropdown.png`

---

## 2) Severity-Ranked Gap List

## Critical

### C1 — Broken first-run state on dashboard (hard failure card with no guided recovery)
- **Evidence:** `03-dashboard-my-projects.png` shows **"Workspace setup failed / Unauthorized"** in primary content region.
- **Impact:** New/returning users can land in a dead-end home experience; trust and activation are impacted immediately.
- **Where:**
  - `src/components/dashboard/hooks/useDashboardState.ts` (bootstrap + error handling)
  - `src/components/dashboard/ProjectsGrid.tsx` (error state rendering path)
  - `src/app/api/workspaces/bootstrap/route.ts` (error response contract)
- **Gap:** Error is surfaced but remediation UX is weak (retry only, no sign-in redirect/fix path).

## High

### H1 — Account identity is inconsistent across shell surfaces
- **Evidence:**
  - `09-account-dropdown.png` shows fallback **User / No email available**
  - `06-settings-profile.png` shows **No authenticated user found**
- **Impact:** Users cannot confirm identity/session confidence; settings appears broken.
- **Where:**
  - `src/components/layout/AccountMenu.tsx`
  - `src/components/settings/sections/ProfileSection.tsx`
  - `src/hooks/useCurrentUser.ts`
  - `src/app/api/me/route.ts`
- **Gap:** Shell permits fallback avatar state while profile API path resolves null/unauthorized; no cohesive "session missing" UX.

### H2 — Auth-to-app continuity is visually disconnected
- **Evidence:** `01-sign-in.png`, `02-sign-up.png` are fully Clerk-centered cards; app shell uses dark Koda layout (`03+` screenshots).
- **Impact:** Abrupt transition increases perceived instability after authentication.
- **Where:**
  - `src/app/sign-in/[[...sign-in]]/page.tsx`
  - `src/app/sign-up/[[...sign-up]]/page.tsx`
  - `src/app/layout.tsx`, shell components
- **Gap:** Branding/layout continuity between auth and product shell is weak.

## Medium

### M1 — Sync/runtime state communication is ambiguous
- **Evidence:** Top-right badge shows **Local-only** in dashboard screenshots without clear next action.
- **Impact:** Users may assume data loss risk but get no explicit remediation.
- **Where:**
  - `src/components/dashboard/SyncStatusIndicator.tsx`
  - `src/stores/app-store.ts` (`initializeSync`)
  - `src/app/api/runtime/sync-capability/route.ts`
- **Gap:** Status label is present, but actionability and context are limited for non-technical users.

### M2 — Dashboard tab IA friction (Projects/Shared/Showcase split + duplicate navigation concepts)
- **Evidence:** Sidebar has Projects/Templates; in-content tabs also contain My projects/Shared/Showcase (`03/04/05`).
- **Impact:** Navigation model feels duplicated; increases cognitive load.
- **Where:**
  - `src/components/layout/Sidebar.tsx`
  - `src/components/dashboard/DashboardTabs.tsx`
  - `src/components/dashboard/DashboardPage.tsx`
- **Gap:** Two levels of similar nav labels with overlapping meaning.

### M3 — Invites tab is passive (no action affordance)
- **Evidence:** `07-settings-invites.png` shows “No invites yet” only.
- **Impact:** Collaboration flow discoverability is low.
- **Where:**
  - `src/components/settings/sections/InviteStatusSection.tsx`
  - `src/components/settings/SettingsContent.tsx`
- **Gap:** Missing CTA/path to invite teammates or open collaboration docs.

## Low

### L1 — Canvas shell first impression is under-instructive
- **Evidence:** `08-canvas-shell.png` has sparse empty space and icon-heavy controls.
- **Impact:** Minor first-use hesitation.
- **Where:**
  - `src/components/canvas/Canvas.tsx`
  - `src/components/canvas/WelcomeOverlay.tsx`
  - `src/components/layout/TopBar.tsx`
- **Gap:** onboarding hints and control labels could be clearer.

### L2 — Minor naming/copy inconsistency
- **Evidence:** “My projects” vs sidebar “Projects”, “Create Project” vs “New project”.
- **Impact:** Low, but affects polish.
- **Where:** dashboard header/tabs/components.

---

## 3) Concrete Fix Recommendations (with File/Component Mapping)

1. **Add guided recovery for bootstrap/auth failures**
   - **What:** When bootstrap returns `401/503`, show clear CTA set: `Sign in`, `Retry`, `Open status/help`.
   - **Files:**
     - `src/components/dashboard/hooks/useDashboardState.ts`
     - `src/components/dashboard/ProjectsGrid.tsx`
     - `src/app/api/workspaces/bootstrap/route.ts`

2. **Unify account identity fallback behavior across dropdown/profile**
   - **What:** If `/api/me` fails, render one consistent “Session unavailable” panel + sign-in CTA (not silent empty identity).
   - **Files:**
     - `src/hooks/useCurrentUser.ts`
     - `src/components/layout/AccountMenu.tsx`
     - `src/components/settings/sections/ProfileSection.tsx`
     - `src/app/api/me/route.ts`

3. **Improve auth-shell visual continuity**
   - **What:** Apply product tokens/layout wrappers around Clerk pages (background, logo treatment, typography hierarchy).
   - **Files:**
     - `src/app/sign-in/[[...sign-in]]/page.tsx`
     - `src/app/sign-up/[[...sign-up]]/page.tsx`
     - Shared auth wrapper component (new under `src/components/auth/`)

4. **Upgrade sync badge from status-only to status+action**
   - **What:** Tooltip/body copy should include explicit guidance (“Enable DB sync in config”, “Sign in to continue”, etc.).
   - **Files:**
     - `src/components/dashboard/SyncStatusIndicator.tsx`
     - `src/lib/runtime/sync-capability.ts`
     - `src/app/api/runtime/sync-capability/route.ts`

5. **Rationalize navigation hierarchy for dashboard tabs vs sidebar**
   - **What:** Keep one primary navigation axis; demote secondary views to filters/segmented controls with clearer naming.
   - **Files:**
     - `src/components/layout/Sidebar.tsx`
     - `src/components/dashboard/DashboardTabs.tsx`
     - `src/components/dashboard/DashboardPage.tsx`

6. **Make invites surface actionable**
   - **What:** Add empty-state CTA (“Invite teammate”, “Learn collaboration”), and route to invite flow.
   - **Files:**
     - `src/components/settings/sections/InviteStatusSection.tsx`
     - `src/components/settings/SettingsContent.tsx`
     - `src/app/api/invites/route.ts` (if action added)

7. **Strengthen canvas empty-state onboarding**
   - **What:** Add short inline helper text + labeled tooltips for primary actions.
   - **Files:**
     - `src/components/canvas/WelcomeOverlay.tsx`
     - `src/components/canvas/Canvas.tsx`
     - `src/components/layout/TopBar.tsx`

---

## 4) Top 5 Quick Wins

1. **Replace dashboard hard-failure dead-end with guided CTA stack** (sign-in + retry + help).  
2. **Normalize user identity fallback copy in Account Menu + Profile** (single source of truth UX).  
3. **Improve sync badge tooltip with explicit remediation text** (not just “Local-only”).  
4. **Add actionable empty-state CTA in Invites tab** (boost collaboration discoverability).  
5. **Align dashboard naming** (“New project” vs “Create Project”, “Projects” vs “My projects”).

---

## Summary
Post-merge baseline is functionally close, but UX quality is currently limited by **error-recovery clarity**, **identity/session coherence**, and **navigation/copy consistency**. Addressing Critical + High items will materially improve first-run trust and reduce user confusion.
