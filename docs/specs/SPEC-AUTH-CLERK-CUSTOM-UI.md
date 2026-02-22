# SPEC: Clerk-Backed Custom Auth UI (Koda)

- **Status:** Draft
- **Owner:** Product + Design + Frontend
- **Date:** 2026-02-22
- **Scope:** `/sign-in` and `/sign-up` auth surfaces only
- **Out of scope:** Backend auth provider swap, custom auth backend, account settings redesign

---

## 0) Objective

Replace the default Clerk widget layout with a **custom Koda-designed auth UI** while preserving:

1. Clerk as the authentication backend and session provider
2. Clerk-based Google sign-in strategy
3. Existing middleware protection and post-auth redirect behavior
4. Reliable, perfectly centered auth layout across all viewport sizes

This is a **UI/UX and integration spec**, not an implementation patch.

---

## 1) UX goals + layout rules (desktop/mobile centering)

## 1.1 UX goals

- Auth should feel native to Koda, not vendor-embedded.
- Visual language must match existing Koda design system (blue accent, neutral surfaces, subtle borders, no gradients/glow).
- Sign-in and sign-up must be visually consistent and structurally predictable.
- Primary user path is low-friction:
  - Continue with Google
  - or Email/password flow
- Error and loading states must be explicit and non-jarring.

## 1.2 Centering and shell layout rules (non-negotiable)

Use a dedicated auth shell with **true viewport centering**:

- Auth page root must center content on both axes for all sizes.
- Do not rely on ad-hoc top margins for placement.
- Apply safe viewport handling for mobile browser UI chrome.

Layout contract:

- Root container: full viewport (`min-h-screen` with `min-h-dvh` fallback strategy)
- Centering model: `display: grid` + `place-items: center` (preferred) or flex equivalent
- Horizontal padding:
  - mobile: 16px
  - tablet+: 24px
- Vertical padding:
  - min 16px, so card never touches edges on short viewports
- Auth card max width: **420px**
- Auth card width: `100%` up to max width
- If viewport height is too small:
  - page can scroll,
  - card remains horizontally centered,
  - top/bottom padding preserved.

## 1.3 Visual composition

- Single auth card on neutral surface
- Optional subtle brand mark (Koda logo) above heading inside card
- No split-screen hero panel for this phase (focused, stable implementation)

---

## 2) Component breakdown (sign-in + sign-up pages)

## 2.1 Shared auth shell components

1. **AuthPageShell**
   - Responsible for viewport centering, background, spacing
2. **AuthCard**
   - Surface, border, radius, internal spacing
3. **AuthHeader**
   - Koda logo (optional), title, subtitle
4. **OAuthSection**
   - Google continue button
5. **DividerWithLabel**
   - “or continue with email”
6. **EmailFormSection**
   - Form fields + primary submit button
7. **AuthFooterLinks**
   - Sign-in/sign-up switch link, legal/support links if needed
8. **InlineFeedbackArea**
   - Validation + backend/auth errors

## 2.2 Sign-in page content

Order:

1. Header: “Welcome back” + subtitle
2. Google button (primary social action)
3. Divider
4. Email input
5. Password input (+ show/hide control)
6. Forgot password link (secondary)
7. Continue button
8. Footer link: “Don’t have an account? Sign up”

## 2.3 Sign-up page content

Order:

1. Header: “Create your account” + subtitle
2. Google button
3. Divider
4. First name (optional if product allows)
5. Last name (optional if product allows)
6. Email input
7. Password input
8. Confirm password (if chosen in UX flow)
9. Create account button
10. Footer link: “Already have an account? Sign in”

Note: Exact field set must remain aligned with enabled Clerk sign-up requirements.

---

## 3) Interaction states for all controls

## 3.1 Buttons (Google + primary submit + secondary links)

Required states:

- Default
- Hover
- Active/pressed
- Focus-visible
- Disabled
- Loading (submit in progress)

Behavior:

- Only one submit action active at a time.
- On loading:
  - show inline spinner,
  - preserve button width (avoid layout shift),
  - disable repeated submits.

## 3.2 Inputs (email/password/name)

Required states:

- Empty
- Filled
- Placeholder
- Hover
- Focus-visible
- Error
- Disabled
- Autofilled

Behavior:

- Validate on blur + on submit.
- Error text appears below field.
- Password visibility toggle must be keyboard-focusable and screen-reader labeled.

## 3.3 Links (switch mode / forgot password)

Required states:

- Default
- Hover
- Focus-visible
- Active

Behavior:

- Must be clearly distinguishable from body text.
- Must preserve adequate hit area (minimum 24px height target for inline links; 44px preferred where feasible).

## 3.4 Global form state

- Idle
- Submitting
- Success (redirect in progress)
- Recoverable error
- Non-recoverable error (fallback messaging + retry affordance)

---

## 4) Styling + token constraints (aligned to current blue design system)

Use existing token system from `src/app/globals.css` + design-spec baseline.

## 4.1 Color tokens (must use)

- `--accent-primary: #3b82f6`
- `--accent-primary-hover: #2563eb`
- `--accent-primary-active: #1d4ed8`
- `--accent-primary-fg: #ffffff`
- `--focus-ring: rgba(59, 130, 246, 0.35)`
- `--focus-ring-strong: rgba(59, 130, 246, 0.5)`
- `--danger: #ef4444`
- `--danger-hover: #dc2626`

Surface/background usage:

- Page background: `bg-background`
- Card surface: `bg-card`
- Card border: `border-border`
- Body text: `text-foreground`
- Secondary text: `text-muted-foreground`

## 4.2 Typography constraints

- Family: Geist Sans for auth UI body + headings for consistency with current unified sans direction
- Heading weight: semibold (600)
- Body weight: 400/500
- No decorative serif headline on auth surface in this phase

## 4.3 Spacing/radius constraints

- Card radius: base token (`--radius`, 12px effective)
- Card padding:
  - mobile: 20px
  - desktop: 24px
- Vertical section gap inside card: 16px
- Field stack gap: 12px
- Label to input gap: 6px
- Control height:
  - input/button min height: 40px
  - preferred: 44px for touch ergonomics

## 4.4 Explicitly banned styles

- No gradient backgrounds on card/buttons
- No glowing shadows/bloom effects
- No animated borders
- No alternate accent colors for primary auth actions

---

## 5) Accessibility requirements

1. **Keyboard**
   - Full flow operable with keyboard only
   - Logical tab order
   - Enter submits primary form
   - Escape only closes transient overlays (if any), not form data

2. **Focus visibility**
   - All interactive elements have visible focus ring using blue focus tokens

3. **Semantics**
   - One H1 per page
   - Inputs associated with labels
   - Error text linked via `aria-describedby`
   - Form-level errors announced via `aria-live="polite"` (or assertive for critical)

4. **Contrast**
   - Text contrast min WCAG AA
   - Focus outline visible against both light/dark backgrounds

5. **Targets + responsiveness**
   - Touch targets >= 44x44 where practical
   - Auth UI usable at 320px width without horizontal scroll

6. **Autofill/password managers**
   - Preserve readability with browser autofill styles
   - Correct `autocomplete` attributes for email/current-password/new-password

---

## 6) Error, loading, and validation behavior

## 6.1 Validation layers

- **Client validation**: format/required checks before API call
- **Clerk response validation**: map Clerk errors to friendly copy
- **Network/system fallback**: generic retry message for unknown failures

## 6.2 Error presentation

- Field-level errors directly under relevant field
- Form-level errors at top of form body (below header)
- Error tone concise, actionable, non-technical

Examples:

- “Enter a valid email address.”
- “Password must be at least 8 characters.”
- “Couldn’t sign you in. Please try again.”

## 6.3 Loading behavior

- Submit button shows spinner + loading label (“Signing in…”, “Creating account…”) 
- Inputs and oauth button disabled during active submit
- Prevent duplicate submit requests

## 6.4 Redirect behavior

- On successful auth completion, redirect to `/` (existing behavior)
- Preserve middleware behavior for already-authenticated users visiting `/sign-in` or `/sign-up` (redirect to `/`)

---

## 7) Clerk integration points (Google, email flow, redirects)

## 7.1 Must keep existing auth architecture

- Keep `ClerkProvider` in root layout
- Keep Clerk middleware route protection
- Keep webhook + server provisioning model
- Do not introduce alternate auth provider/session store

## 7.2 Custom UI implementation contract (functional)

Replace Clerk prebuilt widget components for page layout with custom Koda form UI, while using Clerk APIs/hooks for auth operations.

Expected integrations:

- **Sign-in page**: Clerk sign-in resource/hook
- **Sign-up page**: Clerk sign-up resource/hook
- **Google button**: invoke Clerk strategy `oauth_google`
- **Email/password**: Clerk email/password flow using same backend policies

## 7.3 Redirect contract

- Post-auth success target: `/`
- Sign-out destination (outside this page scope) remains `/sign-in`
- If auth page opened while already signed in, middleware redirects home

## 7.4 Error mapping contract

- Normalize Clerk error payloads to UI copy dictionary
- Unknown error fallback copy required
- Preserve raw error logs only in dev tools (no sensitive internals in UI)

## 7.5 Environment assumptions

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` present for Clerk client flows
- Clerk dashboard has Google provider enabled
- Relevant callback URLs configured in Clerk

---

## 8) Definition of Done + QA checklist

## 8.1 Definition of Done

This spec is complete when all are true:

- [ ] `/sign-in` and `/sign-up` use custom Koda layout (not default Clerk widget layout)
- [ ] Clerk backend/session remains source of truth
- [ ] Google sign-in works via Clerk strategy
- [ ] Email auth flow works end-to-end
- [ ] Auth card is perfectly centered across desktop/tablet/mobile viewports
- [ ] States (default/hover/focus/error/loading/disabled) are implemented for all controls
- [ ] Styling follows blue token constraints and banned styles list
- [ ] Accessibility requirements pass manual checks and automated lint/a11y checks
- [ ] Redirect behavior matches middleware expectations

## 8.2 QA checklist (manual)

### Layout + responsiveness
- [ ] 320px, 375px, 768px, 1024px, 1440px: card centered horizontally and vertically
- [ ] Short viewport height: page scrolls without clipping controls
- [ ] No horizontal overflow on mobile

### Visual consistency
- [ ] Primary action uses `#3b82f6` baseline + hover/active shades
- [ ] No gradients/glow/animated borders on auth UI
- [ ] Spacing, radius, typography match token system

### Interaction states
- [ ] Keyboard focus ring visible on all interactive elements
- [ ] Disabled state blocks interaction and communicates state
- [ ] Loading state prevents duplicate submit
- [ ] Error states appear correctly and clear after correction

### Clerk flows
- [ ] Google sign-in path succeeds and redirects to `/`
- [ ] Email sign-in succeeds and redirects to `/`
- [ ] Email sign-up succeeds and redirects to `/`
- [ ] Invalid credentials show mapped error copy
- [ ] Already authenticated user visiting auth routes is redirected by middleware

### Accessibility
- [ ] Tab order is logical
- [ ] Screen reader announces labels and errors
- [ ] Contrast passes WCAG AA for text + focus

### Regression checks
- [ ] Protected route behavior unaffected
- [ ] `/api/me` still resolves authenticated user data post-login
- [ ] Topbar/UserButton auth continuity unaffected

---

## 9) Risks + mitigations

- **Risk:** Custom flow diverges from Clerk policy settings.
  - **Mitigation:** Field requirements and verification steps sourced from Clerk configuration, not hardcoded assumptions.

- **Risk:** OAuth callback misconfiguration breaks Google path.
  - **Mitigation:** Add explicit staging/prod callback verification in release checklist.

- **Risk:** Centering regressions due to browser viewport behavior.
  - **Mitigation:** Validate using `dvh` strategy + device QA matrix.

---

## 10) Implementation notes (non-code)

- Keep this as a focused auth-shell redesign.
- Avoid introducing auth complexity (MFA UX expansion, enterprise SSO variants) in same PR.
- If Clerk Elements package is used, ensure final classes map to Koda tokens and state rules above.
