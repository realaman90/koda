# 90-Day Milestones — OSS + Hosted

**Repo:** `Fastlanedevs/koda`  
**Window:** Day 0 → Day 90  
**Last updated:** 2026-02-22

---

## Milestone 30D (Day 1–30) — Foundation Stabilized

## Objectives
1. Lock dual-distribution architecture contract
2. Remove critical auth/workspace bootstrap fragility
3. Stand up roadmap execution cadence

## Measurable outcomes
- [ ] Capability matrix for `oss` vs `hosted` is documented and approved
- [ ] Runtime capability check used in UI/server for sync mode and distribution gating
- [ ] Workspace bootstrap success rate for new users reaches `>= 95%` in staging
- [ ] Silent bootstrap failures reduced to `0` (all errors surfaced with actionable state)
- [ ] Weekly roadmap scorecard is live with owner + status for all roadmap issues

## Exit criteria
- All P0 30D issues closed or explicitly deferred with owner/date
- No open Sev-1 auth/workspace regression

---

## Milestone 60D (Day 31–60) — Governance + Launch Candidate Tracks

## Objectives
1. Enforce plugin policy model end-to-end
2. Reach OSS launch-candidate quality
3. Harden hosted reliability and deployment readiness

## Measurable outcomes
- [ ] 100% registered plugins include policy metadata (capabilities, visibility, trust tier)
- [ ] Policy enforcement blocks unauthorized launches in both UI + API paths
- [ ] Plugin execution audit events available for all launch attempts
- [ ] OSS quickstart runs successfully on clean environment in `< 20 min`
- [ ] Hosted deploy + rollback rehearsal completed at least once in staging
- [ ] Critical runbooks published: auth incident, migration rollback, plugin policy override

## Exit criteria
- OSS launch checklist `>= 90%` complete
- Hosted launch checklist `>= 80%` complete
- Error budget trend stable for two consecutive weeks

---

## Milestone 90D (Day 61–90) — Launch + Iteration Loop Operational

## Objectives
1. Achieve OSS launch readiness and publish release process
2. Achieve hosted launch readiness and go-live controls
3. Operationalize GTM/feedback iteration cycle

## Measurable outcomes
- [ ] OSS release tagged with validated install/upgrade docs
- [ ] Hosted readiness sign-off completed (Eng + Product)
- [ ] SLO dashboards + alerts active in production-like environment
- [ ] Activation funnel instrumentation active (signup → first canvas → first plugin run)
- [ ] Weekly triage loop running with top 10 prioritized improvements and owners
- [ ] Launch-critical bug MTTR meets target (e.g., `< 24h` for P0 incidents)

## Exit criteria
- No unresolved P0 roadmap items for launch tracks
- First post-launch iteration backlog approved and sequenced

---

## KPI Snapshot Template (for weekly updates)

| KPI | Baseline | 30D Target | 60D Target | 90D Target |
|---|---:|---:|---:|---:|
| New-user workspace bootstrap success | TBD | >=95% | >=98% | >=99% |
| Plugin launch success rate | TBD | >=95% | >=97% | >=99% |
| OSS clean install success | TBD | >=80% | >=90% | >=95% |
| Hosted deploy rollback rehearsal pass | 0 | 1 pass | 2 passes | ongoing |
| P0 roadmap backlog open count | TBD | downtrend | near-zero | 0 launch blockers |

---

## Suggested Cadence
- **Monday:** KPI + blocker review (Eng/Product)
- **Wednesday:** dependency/risk checkpoint (cross-functional)
- **Friday:** milestone burndown + scope correction
