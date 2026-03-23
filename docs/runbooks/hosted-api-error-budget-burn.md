# Runbook — Hosted API Error Budget Burn

## Trigger

- Fast burn-rate or slow burn-rate alert on API availability budget.

## Immediate triage

1. Identify top 5 failing routes by 5xx volume.
2. Correlate with deployment/change window.
3. Check infra dependencies (DB, storage, auth provider, external AI APIs).

## Mitigation actions

1. Activate incident commander for Sev-1.
2. Roll back latest release if errors began after deploy.
3. Throttle or disable non-critical background workloads.
4. Apply feature flag reductions to protect core flows.

## Communication

- Update incident channel every 15 minutes (Sev-1) / 30 minutes (Sev-2).
- Track user impact and ETA for stabilization.

## Exit criteria

- 5xx ratio returns to baseline.
- Burn rate drops below alert threshold.

## Post-incident

- Blameless retro + action items.
- Add synthetic checks or alert tuning where blind spots were found.
