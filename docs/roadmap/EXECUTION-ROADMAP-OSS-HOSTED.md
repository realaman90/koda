# Execution Roadmap — OSS + Hosted Strategy

**Repo:** `Fastlanedevs/koda`  
**Last updated:** 2026-02-22  
**Planning horizon:** 90 days  
**Goal:** Ship a stable dual-distribution product from one codebase:
- **Koda OSS**: self-hosted, documented, contributor-ready
- **Koda Hosted**: managed cloud experience with onboarding, reliability, and growth loop

---

## 1) Strategy Summary

Koda will run a **single-repo, dual-distribution model**:
- Shared core product logic, UI, and workflow engine
- Distribution-specific behavior controlled via:
  - environment configuration
  - capability checks (`/api/config` + runtime probes)
  - policy gates (auth/workspaces/plugin governance)

This roadmap focuses on six execution tracks:
1. Dual-distribution architecture hardening
2. Auth/workspace stabilization
3. Plugin policy + enforcement
4. OSS launch readiness
5. Hosted launch readiness
6. GTM + iteration loop

---

## 2) Phases, Owners, Timelines, Dependencies, Risks, Success Metrics

## Phase 0 — Program Setup & Baseline (Week 0–1)

**Primary owner:** Engineering Manager / Tech Lead  
**Supporting owners:** Backend Lead, Frontend Lead, DevOps, DX/Docs

### Scope
- Baseline product health (auth funnel, workspace bootstrap, plugin execution paths)
- Define release scorecard and reporting cadence
- Convert roadmap into sequenced GitHub execution board

### Dependencies
- Access to current production/staging telemetry
- Agreement on owners and weekly review ritual

### Key risks
- Ambiguous ownership causes cross-team blocking
- No baseline metrics means no launch confidence

### Success metrics
- Roadmap board created and triaged with owners/priority labels
- Weekly launch scorecard published
- Baseline metrics captured for:
  - signup completion
  - workspace bootstrap success
  - plugin execution success
  - crash/error rate

---

## Phase 1 — Single-Repo Dual-Distribution Hardening (Week 1–3)

**Primary owner:** Platform/Backend Lead  
**Supporting owners:** Frontend Lead, DevOps

### Scope
- Formalize **distribution contract** (OSS vs Hosted capability matrix)
- Remove env-only behavior drift by adding runtime capability checks as source of truth
- Define build/release profiles and CI checks for both distributions

### Dependencies
- Phase 0 baseline complete
- Current config API and storage abstractions available

### Key risks
- Feature behavior diverges between OSS and Hosted
- Regression from hidden env coupling

### Success metrics
- Capability matrix documented + validated in CI
- Both profiles boot from same commit with predictable behavior
- 0 critical config drift bugs in acceptance window

---

## Phase 2 — Auth + Workspace Stabilization (Week 2–5)

**Primary owner:** Backend Lead  
**Supporting owners:** Frontend Lead, QA

### Scope
- Make user provisioning resilient (webhook + fallback self-heal)
- Ensure workspace bootstrap failures are visible/actionable
- Align profile/topbar identity to actual authenticated user and actor record
- Harden auth/workspace rollout tests and failure-mode handling

### Dependencies
- Existing auth/workspace foundation issues (#16–#22)
- Phase 1 runtime capability checks

### Key risks
- Signup success but unusable workspace state
- Silent bootstrap failures hurt trust and retention

### Success metrics
- `>= 99%` successful first-session workspace bootstrap
- `0` silent auth bootstrap failures (all surfaced + traceable)
- `>= 95%` pass rate on auth/collab integration suite in CI

---

## Phase 3 — Plugin Policy + Enforcement (Week 4–7)

**Primary owner:** Platform/Plugin Lead  
**Supporting owners:** Security reviewer, Frontend Lead

### Scope
- Introduce plugin policy model:
  - capability allowlist/denylist
  - distribution visibility (`oss`, `hosted`, `both`)
  - trust tier (`official`, `community`, `private`)
- Enforce policy at registry/load/launch time + server APIs
- Add audit trail + operator controls for plugin execution

### Dependencies
- Phase 1 distribution contract
- Stable auth/workspace actor context from Phase 2

### Key risks
- Unsafe plugin capabilities in OSS/self-hosted contexts
- Hosted plugin governance gaps

### Success metrics
- 100% plugins declare policy metadata
- Blocked plugins cannot launch across UI or API paths
- Plugin policy audit events available for all launch attempts

---

## Phase 4 — OSS Launch Readiness (Week 6–9)

**Primary owner:** DX/Docs Lead  
**Supporting owners:** DevOps, Backend Lead

### Scope
- Self-host install path hardening (`setup.sh`, `.env.example`, migrations, smoke tests)
- Contributor docs and support policy (issues, bug templates, security note)
- OSS release checklist + tagged release process

### Dependencies
- Phases 1–3 complete or feature-flagged safely
- Stable local-storage + sqlite path in docs

### Key risks
- Broken first-run experience for self-hosters
- High support burden due to unclear docs

### Success metrics
- OSS quickstart succeeds on clean machine in `< 20 min`
- Release checklist complete with reproducible tagged artifact
- OSS docs cover install, upgrade, troubleshooting, and policy boundaries

---

## Phase 5 — Hosted Launch Readiness (Week 7–11)

**Primary owner:** DevOps / Platform SRE  
**Supporting owners:** Backend Lead, Frontend Lead

### Scope
- Hosted environment matrix (staging/prod parity, secrets, migrations, rollback)
- Reliability SLOs, alerting, on-call runbooks
- Billing/plan guardrails (if applicable), tenancy guardrails, incident process

### Dependencies
- Phases 2–3 stable for auth/plugin governance
- Phase 1 deployment profile parity

### Key risks
- Launch-day incidents from weak rollout controls
- Data/tenant isolation regressions

### Success metrics
- Deployment + rollback rehearsed and documented
- Error-budget/SLO dashboards active
- Hosted launch readiness review signed off by Eng + Product

---

## Phase 6 — GTM + Iteration Loop (Week 10–13)

**Primary owner:** Product Lead  
**Supporting owners:** Engineering Manager, Docs/Community

### Scope
- Instrument user funnel (activation, retention, plugin adoption)
- Establish weekly triage loop from GitHub issues + telemetry
- Run first launch cohort and prioritize vNext backlog

### Dependencies
- OSS + Hosted launch checklists complete
- Telemetry events and dashboards available

### Key risks
- No feedback loop → slow product learning
- Roadmap drift post-launch

### Success metrics
- Weekly metric review cadence in place
- Top 10 post-launch improvements ranked and assigned
- Time-to-fix for launch-critical bugs within SLA target

---

## 3) Cross-Phase Dependency Graph

1. **Phase 0** unlocks all execution.
2. **Phase 1** (distribution contract) is prerequisite for robust plugin policy and stable launch packaging.
3. **Phase 2** (auth/workspace) is prerequisite for reliable hosted onboarding and permissioned plugin actions.
4. **Phase 3** (plugin policy) is prerequisite for both OSS and Hosted launch trust/safety.
5. **Phase 4 + Phase 5** can run partially in parallel after Phases 1–3 are stable.
6. **Phase 6** starts once launch readiness gates are met.

---

## 4) Governance & Operating Cadence

- **Weekly Roadmap Review (45 min)**
  - Blockers, dependency shifts, risk burndown
- **Twice-weekly Launch Standup (15 min)**
  - Auth funnel health, plugin incidents, deployment risk
- **Definition of Done (per issue)**
  - Acceptance criteria met
  - Tests/monitoring updated
  - Docs/runbooks updated where applicable

---

## 5) Release Gates

A phase is launch-ready only when:
- P0 issues for phase are closed
- No unresolved critical risk in that phase
- Metrics target met (or approved exception documented)
- Owner sign-off recorded in issue comments/checklist

---

## 6) Planned Roadmap Issue Groups

Roadmap execution issues are grouped by phase and tracked with label `roadmap` plus domain/priority labels:
- P0/P1/P2
- backend/frontend/devops/documentation

See issue batch created in GitHub for active links and implementation order.
