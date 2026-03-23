# Phase 5 — Hosted Launch Readiness (Issue #45)

## 1) Environment parity matrix (staging vs production)

| Category | Check | Staging | Production | Verification method |
|---|---|---|---|---|
| Runtime profile | `KODA_DISTRIBUTION_MODE` | `hosted` | `hosted` | `GET /api/health` payload |
| Auth | Clerk publishable + secret keys | ✅ | ✅ | sign-in smoke + webhook delivery |
| Database | Turso URL/token | dedicated staging DB | production DB | migration dry-run + schema checksum |
| Storage | Asset backend + bucket | staging bucket/prefix | production bucket/prefix | upload + retrieve smoke |
| Plugin policy | trust-tier env allowlist | official,verified | official,verified | launcher deny/allow audit |
| Feature flags | workspace/plugin gates | mirrored | mirrored | `/api/config` diff check |
| Monitoring | logs/metrics/alerts sinks | staging project | production project | alert test event + dashboard ingest |
| Incident contacts | on-call + escalation alias | ✅ | ✅ | paging test |

Parity sign-off owner: Platform SRE (weekly launch review).

## 2) Migration runbook

### Preflight

1. Confirm release commit SHA + migration diff reviewed.
2. Validate backup/snapshot recency for target DB.
3. Run:
   - `npm run build`
   - distribution parity checks (`npm run ci:smoke-profile -- --profile hosted`)
4. Confirm error budget headroom and no active Sev-1 incidents.

### Canary migration

1. Deploy migration to staging.
2. Execute `npm run db:migrate` on hosted staging DB.
3. Run auth/workspace/plugin smoke set.
4. Promote to production canary slice (single instance / lowest traffic window).
5. Watch 15-minute window:
   - API 5xx rate
   - auth bootstrap failures
   - plugin launch denial anomalies

### Rollback decision points

Rollback immediately if any of the following is true:

- sustained API 5xx above threshold for 5 minutes,
- migration error blocks writes,
- auth bootstrap regression prevents new user onboarding,
- critical data correctness issue detected.

### Rollback execution

1. Halt rollout.
2. Roll app to previous image/tag.
3. If schema is incompatible, restore DB from preflight snapshot.
4. Re-run smoke checks on rolled-back target.
5. Publish incident summary + corrective action follow-up issue.

## 3) Rollback rehearsal record

**Rehearsal ID:** `hosted-rollback-drill-2026-02-22`  
**Scope:** staging full cycle (deploy latest -> induce failure condition -> rollback to prior image)  
**Outcome:** ✅ completed

### Steps executed

1. Migrated staging using current `npm run db:migrate`.
2. Ran API health/config + auth/workspace bootstrap smoke.
3. Simulated rollout abort condition by deploying a fault-injected config.
4. Executed rollback runbook to previous image.
5. Re-validated smoke checks and plugin launch paths.

### Evidence

- Launch decision log: `docs/roadmap/phase-5-hosted-launch-readiness.md` (this record)
- Smoke command outputs captured during drill in release meeting notes.

### Follow-ups

- Keep rollback drill cadence: at least one rehearsal per release milestone.
- Attach next drill artifacts in roadmap issue comments before production cut.
