# Runbook — Hosted Plugin Launch Degradation

## Trigger

- Plugin launch success SLO alert fires.
- One plugin route has elevated failures (>=10% absolute drop).

## Immediate triage

1. Identify affected plugin IDs.
2. Check plugin policy deny spikes (`[plugin-policy-audit]`).
3. Validate external provider health (Anthropic/Fal as applicable).

## Mitigation options

1. Roll back latest plugin-related deploy.
2. Apply temporary trust-tier override for containment.
3. Disable affected plugin for hosted distribution if needed.

## Exit criteria

- Launch success back within SLO for 30 minutes.
- User-facing errors reduced to normal baseline.

## Post-incident

- Record decision timeline.
- Add policy/config validation if issue was preventable.
- Update plugin governance playbook when needed.
