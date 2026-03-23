# Phase 5 — Hosted Observability, SLOs, Alerts, Runbooks (Issue #46)

## 1) Hosted SLO dashboard definition

Dashboard: `Hosted Launch Reliability`

### SLI/SLO set

| SLI | Definition | Target SLO | Window | Owner |
|---|---|---|---|---|
| Auth bootstrap success | `workspace_bootstrap` success / total bootstrap attempts | >= 99.0% | 7d rolling | Auth/Platform |
| Plugin launch success | `plugin_execution` success / total plugin executions | >= 97.0% | 7d rolling | Plugin Platform |
| API error budget | 1 - (`5xx requests` / `total API requests`) | >= 99.5% availability | 30d rolling | Backend SRE |

### Required dashboard panels

1. Auth bootstrap success rate (hourly + 7d trend)
2. Plugin execution success split by plugin ID
3. API 5xx % and error-budget burn rate (1h/6h/24h)
4. Top failing endpoints and regression delta (day-over-day)

## 2) Alerting + severity routing

| Alert | Trigger | Severity | Route |
|---|---|---|---|
| Auth bootstrap SLO breach risk | success < 99% for 30m | Sev-2 | Platform on-call + auth owner |
| Plugin launch degradation | success < 97% for 30m OR single plugin < 90% | Sev-2 | Plugin on-call + product owner |
| API burn-rate fast | budget burn > 4x in 1h | Sev-1 | SRE primary + incident commander |
| API burn-rate slow | budget burn > 2x in 6h | Sev-2 | SRE secondary |

Ownership map:

- Primary on-call: Platform SRE
- Secondary: Backend lead
- Product escalation: Product owner for launch

## 3) Incident runbook index

Top hosted failure scenarios are covered by:

1. [`docs/runbooks/hosted-auth-bootstrap-incident.md`](../runbooks/hosted-auth-bootstrap-incident.md)
2. [`docs/runbooks/hosted-plugin-launch-incident.md`](../runbooks/hosted-plugin-launch-incident.md)
3. [`docs/runbooks/hosted-api-error-budget-burn.md`](../runbooks/hosted-api-error-budget-burn.md)

These runbooks define triage checks, mitigation actions, rollback criteria, and post-incident follow-up.
