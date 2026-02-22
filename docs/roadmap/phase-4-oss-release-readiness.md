# Phase 4 — OSS Release Readiness Automation (Issue #43)

This document defines the repeatable smoke evidence required before tagging an OSS release candidate.

## 1) Automated smoke command

Run from repo root:

```bash
npm run ci:oss-release-smoke -- --mode all --report reports/roadmap/phase4/<tag>-oss-smoke.json
```

What this validates:

- **Install smoke**
  - `scripts/setup.sh` executes end-to-end (env bootstrap + migration)
  - `.env` bootstrap path is created from `.env.example`
  - SQLite DB is created and migrated
  - production build starts and passes `/api/health` + `/api/config`
- **Upgrade smoke**
  - starts from legacy `canvases` schema snapshot
  - runs latest `npm run db:migrate`
  - confirms compatibility/backfill (`thumbnail -> thumbnail_url`, status `ready`)

## 2) OSS setup/update entry points

- `scripts/setup.sh` — first-run bootstrap script for self-host users.
- `scripts/update.sh` — pulls latest and re-runs setup/migrations for upgrades.

Both scripts support flags for CI/non-interactive flows.

## 3) Tag candidate checklist (smoke evidence required)

For each release candidate tag `vX.Y.Z-rcN`, fill all rows before promotion:

| Candidate tag | Install smoke report | Upgrade smoke report | Owner | Status |
|---|---|---|---|---|
| _example: v0.9.0-rc1_ | `reports/roadmap/phase4/v0.9.0-rc1-oss-smoke.json` | same report (`mode=all`) | DX/Docs | ✅ |

> Requirement: every candidate must include a report artifact link in PR/release notes.

## 4) CI recommendation

Add to release workflow before tagging:

1. `npm run build`
2. `npm run ci:oss-release-smoke -- --mode all --report reports/roadmap/phase4/<sha>-oss-smoke.json`
3. Upload report artifact and link it in release checklist
