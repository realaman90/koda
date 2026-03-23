# Phase 1 — Dual-Distribution Capability Contract (Issue #34)

This document defines the single-repo runtime contract for **OSS** and **Hosted** distributions.

## 1) Distribution Resolution Contract

Runtime distribution is resolved in this order:

1. `KODA_DISTRIBUTION` (`oss` | `hosted`)
2. `NEXT_PUBLIC_KODA_DISTRIBUTION` (`oss` | `hosted`)
3. `KODA_LAUNCH_ENV` (`oss` | `hosted`) for backward compatibility
4. Inference fallback:
   - `hosted` when any cloud profile signal is present (`SANDBOX_PROVIDER=e2b`, `TURSO_DATABASE_URL`, `ASSET_STORAGE=r2`, `SNAPSHOT_STORAGE=r2`)
   - otherwise `oss`

Fallback default is always **`oss`**.

---

## 2) Capability Matrix

| Capability | OSS | Hosted | Required runtime config / notes |
| --- | :--: | :--: | --- |
| Auth v1 (`auth_v1`) | ✅ | ✅ | Clerk keys required for protected routes. |
| Workspaces v1 (`workspaces_v1`) | ✅ | ✅ | Requires auth + workspace bootstrap API. |
| Collaboration sharing v1 (`collab_sharing_v1`) | ✅ | ✅ | Requires workspaces + invite routes enabled. |
| Local SQLite (`local_sqlite`) | ✅ | ✅ | `NEXT_PUBLIC_STORAGE_BACKEND=sqlite`; optional `SQLITE_PATH`. |
| Turso SQLite (`turso_sqlite`) | ✅ | ✅ | `TURSO_DATABASE_URL`; `TURSO_AUTH_TOKEN` recommended/required for protected DBs. |
| Local assets (`local_assets`) | ✅ | ✅ | `ASSET_STORAGE=local`; optional `ASSET_LOCAL_PATH`. |
| R2 assets (`r2_assets`) | ✅ | ✅ | `ASSET_STORAGE=r2` + `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`. |
| S3 assets (`s3_assets`) | ✅ | ✅ | `ASSET_STORAGE=s3` + `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET_NAME`. |
| Docker sandbox (`docker_sandbox`) | ✅ | ✅ | `SANDBOX_PROVIDER=docker` (local runner). |
| E2B sandbox (`e2b_sandbox`) | ✅ | ✅ | `SANDBOX_PROVIDER=e2b` + `E2B_API_KEY` + template id. |
| Local snapshots (`local_snapshots`) | ✅ | ✅ | `SNAPSHOT_STORAGE=local`. |
| R2 snapshots (`r2_snapshots`) | ✅ | ✅ | `SNAPSHOT_STORAGE=r2` + R2 credentials. |

> Both distributions intentionally share the same code paths. “OSS vs Hosted” controls profile defaults and operational posture, not separate forks.

---

## 3) Runtime Validation Rules

Validation is provided by `validateDistributionRuntimeContract()` in:

- `src/lib/distribution/capabilities.ts`

Rules enforced:

- `SANDBOX_PROVIDER=e2b` requires `E2B_API_KEY` and `E2B_TEMPLATE_ID_REMOTION` (or fallback `E2B_TEMPLATE_ID`).
- `ASSET_STORAGE=r2` requires R2 credentials.
- `ASSET_STORAGE=s3` requires S3 credentials.
- `SNAPSHOT_STORAGE=r2` requires R2 credentials.
- `TURSO_DATABASE_URL` without `TURSO_AUTH_TOKEN` yields a warning.
- Missing Clerk keys yields a warning.
- Hosted profile with local-default providers yields warnings (non-blocking).

---

## 4) Distribution-Sensitive Runtime Gating

Critical rollout toggles now require both:

1. capability support in the active distribution profile, and
2. feature flag value (`AUTH_V1`, `WORKSPACES_V1`, `COLLAB_SHARING_V1`)

Implemented in:

- `src/lib/distribution/capabilities.ts`
- `src/lib/flags.ts`

This removes env-only gating for distribution-sensitive paths in middleware and protected APIs.
