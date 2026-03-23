# Runbook — Hosted Auth Bootstrap Incident

## Trigger

- Auth bootstrap success-rate alert fired, or
- spike in `/api/workspaces/bootstrap` failures.

## Immediate triage (first 15 min)

1. Confirm impact window and affected tenant scope.
2. Check recent deploys + config/secrets changes.
3. Inspect logs for `metric=workspace_bootstrap` errors by code.

## Mitigation

1. If recent deploy correlates, roll back to previous release.
2. Validate Clerk webhook health + retries.
3. If workspace creation path is failing, disable risky feature flags and keep bootstrap minimal path active.

## Exit criteria

- Bootstrap success restored above threshold for 30 minutes.
- No active auth blocking incident for new signups.

## Post-incident

- Capture root cause.
- Add regression test if missing.
- Update launch checklist or guardrails.
