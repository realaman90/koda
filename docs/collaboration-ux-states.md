# Collaboration UX States (Issue #21)

## Onboarding

- Dashboard bootstrap call (`POST /api/workspaces/bootstrap`) auto-provisions personal workspace if missing.
- First signed-in users land on segmented dashboard with Personal + Team sections.

## Dashboard states

- Workspace switcher in dashboard header.
- Project cards include badges:
  - `Personal`
  - `Team`
  - `Shared`
  - `Read-only`
- Viewer/read-only cards disable mutation actions and explain why.

## Invite states

- Invite status list available on dashboard and Settings → Invites.
- Displays statuses: `pending`, `accepted`, `declined`, `revoked`, `expired`.

## Empty/loading/error

- Existing loading skeletons + error cards retained.
- Team and Shared sections show same blue design-system cards/components for consistency.
