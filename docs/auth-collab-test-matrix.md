# Auth + Collaboration Test Matrix (Issue #22)

## Automated suites

- `npm run db:validate:collab` — schema/index/constraint CRUD smoke
- `npm run db:validate:backfill` — migration dry-run + idempotency regression
- `npm run validate:permissions` — owner/admin/editor/viewer matrix
- `npm run validate:invites` — invite lifecycle + idempotent membership behavior
- `npm run build` — typecheck + route compilation gate

## Coverage mapping

- Sign-in + protected routes: middleware + Clerk setup (`#16`) + build route checks
- Role matrix behavior: `validate:permissions`
- Invite lifecycle transitions: `validate:invites`
- Ownership transfer atomicity: API transaction implementation + manual QA case
- Backfill stability: `db:validate:backfill`

## Manual QA checklist

- [ ] Unauthenticated hit to `/canvas/[id]` redirects to sign-in and returns correctly after auth
- [ ] Viewer opens canvas, sees read-only badge/message, mutation controls disabled
- [ ] Owner/admin invite flow works end-to-end (`pending -> accepted/declined/revoked/expired`)
- [ ] Ownership transfer changes owner and demotes previous owner atomically
- [ ] Logout blocks protected page revisit without re-authentication
