# AUTH / USER FLOW DEEP AUDIT — 2026-02-22

## Executive Summary

The regression is **real** and caused by a combination of architectural gaps + config coupling:

1. **User provisioning is webhook-only and hard-blocking**. If Clerk webhook sync is delayed/misconfigured, all actor-backed APIs return `409 User not provisioned yet`.
2. **Dashboard bootstrap failure is silently ignored**, so the app appears to work but never enters workspace-backed flow.
3. **"Local" mode indicator is based on `NEXT_PUBLIC_STORAGE_BACKEND` only**, while server DB can still be active via Turso/SQLite config. This creates false "Local" status.
4. **Settings/Profile and topbar user UI are hardcoded local placeholders** (not bound to Clerk or DB user record), so signed-in details never render.
5. **Feature flags `WORKSPACES_V1` and `COLLAB_SHARING_V1` are defined but not wired**; rollout control is effectively non-functional.

Net effect matches reported symptoms exactly:
- Signup works in Clerk ✅
- Post-signup app does not reliably transition into provisioned workspace flow ❌
- Workspace/sync indicator stays `Local` ❌
- Settings/Profile does not show authenticated user data ❌

---

## Validation Performed

- `npm run build` passed.
- `npm run db:migrate` passed (current runtime was using Turso DB config).
- DB spot-check (sanitized): `users/workspaces/workspace_members` are present but only one synced user row existed, consistent with webhook-dependent provisioning.
- Unauthenticated request to protected API (`POST /api/workspaces/bootstrap`) showed Clerk middleware rewrite/protect behavior (`x-clerk-auth-reason: protect-rewrite`).

---

## End-to-End Audit Findings (Scoped)

## 1) Clerk auth session state (sign-up/sign-in/sign-out)

### Evidence
- Sign-up page: `src/app/sign-up/[[...sign-up]]/page.tsx:1-9` (`<SignUp forceRedirectUrl="/" />`)
- Sign-in page: `src/app/sign-in/[[...sign-in]]/page.tsx:1-9` (`<SignIn forceRedirectUrl="/" />`)
- Middleware gate + redirect for already-authenticated auth pages: `src/middleware.ts:13-26`
- No sign-out control or Clerk user surface in UI (topbar avatar hardcoded): `src/components/layout/TopBar.tsx:258-261`

### Finding
- Sign-up/sign-in redirect flow exists.
- **Sign-out UX is missing** in app shell.
- Session can be valid in Clerk but still unusable for app APIs if DB user not provisioned.

---

## 2) Middleware/protection/public routes behavior

### Evidence
- Public matcher includes `/sign-in`, `/sign-up`, `/api/webhooks/clerk`: `src/middleware.ts:5-9`
- All non-public routes call `auth.protect()`: `src/middleware.ts:24-26`

### Finding
- Middleware protection itself is correct for auth gating.
- Main issue is **post-auth provisioning**, not route protection.

---

## 3) Webhook path + signature verification + user upsert

### Evidence
- Webhook route: `src/app/api/webhooks/clerk/route.ts`
- Signature secret required: `:38-45`
- Svix verification: `:62-73`
- Upsert on `user.created/user.updated`: `:83-116`

### Finding
- Webhook implementation is structurally correct.
- System has a hard dependency on webhook delivery for first-login provisioning.
- Any webhook misrouting/signature mismatch/network issue causes downstream 409s in actor resolution.

---

## 4) Actor resolution (`clerk_user_id` -> internal user)

### Evidence
- Actor lookup by Clerk user id: `src/lib/auth/actor.ts:19-21`
- Hard fail if not found: `src/lib/auth/actor.ts:22-29` (`409 User not provisioned yet...`)

### Finding
- **No lazy/self-healing provisioning fallback** (e.g., fetch Clerk user server-side + create internal row).
- This is the primary choke point after signup.

---

## 5) Workspace bootstrap/provisioning after first login

### Evidence
- Bootstrap endpoint creates personal workspace if missing: `src/app/api/workspaces/bootstrap/route.ts:20-44`
- But bootstrap first requires `requireActor()`: `:11-12`

### Finding
- Workspace bootstrap is correct **only after user row exists**.
- If actor resolution fails, bootstrap never executes.

---

## 6) Dashboard data source + why it still shows Local mode

### Evidence
- Dashboard init calls bootstrap but ignores non-OK response: `src/components/dashboard/hooks/useDashboardState.ts:120-125`
- Sync mode depends on `isSQLiteConfigured()` in client store: `src/stores/app-store.ts:147-153`
- `isSQLiteConfigured()` checks only `NEXT_PUBLIC_STORAGE_BACKEND === 'sqlite'`: `src/lib/storage/index.ts:37-47,87-89`
- Sync badge shows hardcoded `Local` when disabled: `src/components/dashboard/SyncStatusIndicator.tsx:17-33`
- API canvases backend still reports `sqlite`: `src/app/api/canvases/route.ts:48`

### Finding
- **Frontend sync mode and server DB mode are decoupled/misaligned**.
- If `NEXT_PUBLIC_STORAGE_BACKEND` is absent, UI goes Local even while server DB is active.
- Bootstrap API failure is silent, so user sees dashboard but not workspace-bound state.

---

## 7) Settings/Profile binding and fallback logic

### Evidence
- Profile uses local React state defaults (`User`, empty email): `src/components/settings/sections/ProfileSection.tsx:8-10`
- Hardcoded account block says `Local Mode` + disabled sign-up CTA: `:95-106`
- Topbar avatar hardcoded `A`: `src/components/layout/TopBar.tsx:258-261`

### Finding
- Settings/Profile is currently a placeholder, not connected to Clerk or DB user.
- Reported "does not show signed-in user details" is expected with current implementation.

---

## 8) Feature flag interactions (`AUTH_V1`, `WORKSPACES_V1`, `COLLAB_SHARING_V1`)

### Evidence
- Flags defined: `src/lib/flags.ts:1-11`
- Only `AUTH_V1` used (middleware): `src/middleware.ts:3,14`
- No code usage found for `isWorkspacesV1Enabled` / `isCollabSharingV1Enabled`.

### Finding
- `WORKSPACES_V1` and `COLLAB_SHARING_V1` currently have no runtime effect.
- Rollout toggles are not enforcing behavior, increasing regression risk.

---

## 9) Env/config assumptions and failure modes

### Key assumptions currently baked into code

1. **Webhook must succeed before any actor-backed API can function**.
2. **Client sync enablement requires `NEXT_PUBLIC_STORAGE_BACKEND=sqlite`** (regardless of server DB availability).
3. **DB schema must already exist**; no auto-migrate on app startup (`src/lib/db/index.ts` does not run migrations).
4. `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` gates ClerkProvider in layout (`src/app/layout.tsx:39,71-75`), but server middleware/auth still run.

### Failure modes
- Webhook not configured/reachable → user stuck in 409 provisioning gap.
- Missing/incorrect `CLERK_WEBHOOK_SIGNING_SECRET` → webhook 400/500.
- Missing `NEXT_PUBLIC_STORAGE_BACKEND=sqlite` → persistent Local badge + disabled sync path.
- Missing migration run → runtime DB errors on user/workspace queries.

---

## Reproduction Steps

### Repro A — Post-signup actor gap (core)
1. Start app with Clerk enabled.
2. Create a **new** Clerk user (not present in internal `users` table).
3. Land on `/` after signup.
4. Observe network call `POST /api/workspaces/bootstrap`.
5. If webhook has not upserted user yet, response path is `requireActor()` -> `409` (`src/lib/auth/actor.ts:22-29`).
6. UI silently continues (no surfaced blocking error), memberships remain empty.

### Repro B — Local indicator mismatch
1. Run app without `NEXT_PUBLIC_STORAGE_BACKEND=sqlite`.
2. Open dashboard.
3. `initializeSync()` sets `isSyncEnabled=false` (`src/stores/app-store.ts:149-153`).
4. Sync badge renders `Local` (`src/components/dashboard/SyncStatusIndicator.tsx:17-33`) even if server DB endpoints are active.

### Repro C — Settings user details missing
1. Sign in successfully.
2. Open Settings → Profile.
3. Observe static defaults (`User`, no email, Local Mode messaging) from `ProfileSection` local state (`ProfileSection.tsx:8-10,95-106`).

---

## Severity & Prioritized Fix Plan

## P0 (must fix first)

1. **Provisioning resilience at actor boundary**
   - Add fallback in `requireActor()` when user row is missing:
     - fetch Clerk user server-side using `CLERK_SECRET_KEY`
     - upsert internal user row
     - retry actor resolution
   - Return 503 with retry hint only if fallback fails.

2. **Surface bootstrap failure in dashboard**
   - Do not silently ignore non-OK from `/api/workspaces/bootstrap`.
   - Show explicit blocking/toast state with actionable reason.

## P1

3. **Fix sync/local indicator source of truth**
   - Replace env-only gate with runtime capability check (`/api/config` or `/api/canvases` probe).
   - Reflect actual server persistence availability in badge/status text.

4. **Bind Profile/Topbar to real auth user**
   - Use Clerk client hooks (`useUser`) and/or `/api/me` endpoint backed by internal user row.
   - Remove hardcoded Local Mode messaging and fake sign-up CTA.

## P2

5. **Wire feature flags properly** (`WORKSPACES_V1`, `COLLAB_SHARING_V1`) to route handlers/UI sections.
6. Add sign-out affordance (`UserButton`/explicit sign-out action).

---

## Exact Patch Plan (surgical)

## A) Actor fallback provisioning

### File
- `src/lib/auth/actor.ts`

### Changes
- In `requireActor()` after missing-user branch:
  - call new helper `provisionUserFromClerk(session.userId)`.
  - helper uses Clerk backend client (`@clerk/nextjs/server` + Clerk client) to fetch user profile.
  - upsert into `users` table (same schema as webhook).
  - re-query user + memberships.
- Keep existing webhook path; fallback is safety net, not replacement.

## B) Dashboard bootstrap error handling

### File
- `src/components/dashboard/hooks/useDashboardState.ts`

### Changes
- At `bootstrapResponse` handling:
  - if `!ok`, parse error and set `loadError` + toast with actionable message.
  - avoid silent continue when actor/bootstrap fails.
- Optionally gate `loadCanvasList()` on successful bootstrap when auth/workspaces are enabled.

## C) Sync mode truth source

### Files
- `src/stores/app-store.ts`
- `src/lib/storage/index.ts` (or deprecate `isSQLiteConfigured` usage)
- `src/components/dashboard/SyncStatusIndicator.tsx`

### Changes
- In `initializeSync()`, detect sync capability via network probe (`/api/canvases` or `/api/config`) not only env var.
- Set `isSyncEnabled` from runtime response.
- Update tooltip copy to distinguish:
  - local-only
  - authenticated DB sync available
  - authenticated but provisioning blocked

## D) User identity binding in UI

### Files
- `src/components/settings/sections/ProfileSection.tsx`
- `src/components/layout/TopBar.tsx`
- (new) `src/app/api/me/route.ts` (optional if internal user data needed)

### Changes
- Replace local placeholder state with Clerk user data (`useUser`) and/or `/api/me`.
- Render real avatar initials/image + email.
- Remove hardcoded "Local Mode / Sign Up coming soon" block; replace with real account state.

## E) Feature-flag enforcement

### Files
- `src/app/api/workspaces/bootstrap/route.ts`
- `src/app/api/invites/route.ts`
- `src/app/api/invites/[token]/route.ts`
- `src/app/api/workspaces/[workspaceId]/**`
- `src/components/settings/SettingsContent.tsx` (invites tab visibility)

### Changes
- Apply `isWorkspacesV1Enabled()` and `isCollabSharingV1Enabled()` gates at API and UI boundaries.
- Return clear `404/403` depending on desired rollout semantics.

## F) Auth shell controls

### Files
- `src/components/layout/TopBar.tsx`

### Changes
- Replace static avatar with Clerk `UserButton` (includes sign-out) or equivalent menu.

---

## Recommended Order of Execution

1. Implement A + B (unblocks first-login failures and debuggability).
2. Implement C (fixes Local misreporting).
3. Implement D (fixes user details in Settings/Topbar).
4. Implement E/F (rollout hygiene + auth UX completeness).

---

## Go/No-Go

**No-Go for production rollout of auth/workspaces as-is.**

Minimum acceptable hotfix set: **A + B + C**.
