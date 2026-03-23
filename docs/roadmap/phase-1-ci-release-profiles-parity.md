# Phase 1 — CI Release Profiles for OSS + Hosted Parity (Issue #35)

This phase adds a CI gate that validates OSS and Hosted runtime profiles from the same commit.

## Workflow

- **Workflow:** `.github/workflows/distribution-parity-gate.yml`
- **PR trigger scope:** runtime/config/auth/plugin-impacting paths
  - `src/lib/distribution/**`
  - `src/lib/config/**`
  - `src/lib/auth/**`
  - `src/app/api/config/**`
  - `src/app/api/health/**`
  - `src/app/api/plugins/**`
  - `src/middleware.ts`
  - CI workflow/script files

## Per-profile checks

Each matrix profile (`oss`, `hosted`) runs:

1. `npm run validate:distribution-contract`
2. `npm run build`
3. `npm run ci:smoke-profile -- --profile <profile>`
   - implemented by `src/lib/ci/smoke-profile.ts`
   - starts production server from the built output
   - validates `GET /api/health`
   - validates minimal API smoke path: `GET /api/config`
   - writes a JSON profile report (`reports/ci-parity/<profile>.json`)

## Release-candidate artifact

On release-candidate runs (`push` tags containing `rc`, or `workflow_dispatch` with `release_candidate=true`):

- CI downloads both profile reports
- builds `reports/ci-parity/parity-report.json`
- uploads the artifact as **`distribution-parity-report`**

This artifact gives a single parity snapshot for OSS vs Hosted startup/health/API smoke readiness.
