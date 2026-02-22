# Phase 6 — GTM Instrumentation + Weekly Iteration Loop (Issue #47)

## 1) Activation funnel instrumentation

Activation funnel events now emitted via launch-metric logs:

1. `activation_signup`
2. `activation_first_workspace`
3. `activation_first_canvas`
4. `activation_first_plugin_run`

These events complement existing operational metrics (`signup_completion`, `workspace_bootstrap`, `plugin_execution`) and enable weekly funnel conversion review.

## 2) Weekly triage workflow

Cadence: **weekly (45 min)**

### Inputs

- Activation funnel conversion rates (signup -> workspace -> canvas -> plugin run)
- SLO health and launch incident summaries
- New GitHub issues/bugs from OSS + Hosted channels

### Agenda

1. KPI snapshot (10m)
2. Regression/outlier review (10m)
3. Candidate improvements review (15m)
4. Decision log + owner assignment (10m)

### Decision log template

| Week | KPI trend summary | Decisions | Owner | Due date |
|---|---|---|---|---|
| 2026-W09 | _fill_ | _fill_ | _fill_ | _fill_ |

## 3) Top-10 post-launch improvements (prioritized)

| Priority | Improvement | Owner | Target date |
|---|---|---|---|
| 1 | Reduce first-plugin-run latency with warm sandbox pool | Platform | 2026-03-05 |
| 2 | Improve signup failure UX with actionable provider error copy | Frontend | 2026-03-07 |
| 3 | Add plugin launch retries for transient upstream API errors | Backend | 2026-03-10 |
| 4 | Add workspace bootstrap synthetic monitor in hosted staging | SRE | 2026-03-08 |
| 5 | Expand OSS troubleshooting with provider quota failure playbook | Docs | 2026-03-11 |
| 6 | Add auth webhook delay compensation and dashboard panel | Auth Platform | 2026-03-12 |
| 7 | Improve first-canvas onboarding with contextual templates | Product/Frontend | 2026-03-14 |
| 8 | Add plugin capability denial UX linking policy docs | Frontend | 2026-03-13 |
| 9 | Harden migration preflight with auto schema diff report | Platform | 2026-03-15 |
| 10 | Add weekly launch review automation summary script | DX/DevOps | 2026-03-16 |

## 4) Ownership

- Workflow owner: Product lead
- KPI extraction owner: Data/Platform
- Roadmap maintenance owner: Engineering manager
