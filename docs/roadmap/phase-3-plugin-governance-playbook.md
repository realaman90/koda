# Phase 3 — Plugin Governance + Operator Playbook (Issue #42)

Defines how plugin policy decisions are reviewed, approved, and operated across OSS and Hosted deployments.

## 1) Governance Model

### 1.1 Policy goals

- Prevent undeclared capabilities from reaching runtime.
- Keep OSS and Hosted behavior predictable via explicit distribution visibility.
- Apply trust-tier controls consistently in both launcher and API paths.
- Ensure every launch decision (allow/deny) is auditable.

### 1.2 Trust model

Koda uses three trust tiers:

- `official`: first-party plugins maintained by Koda.
- `verified`: third-party plugins reviewed by Koda maintainers.
- `community`: unverified community plugins.

Default effective policy by distribution:

- **Hosted:** `official`, `verified`
- **OSS:** `official`, `verified`, `community`

Runtime override (all distributions):

- `KODA_PLUGIN_TRUST_TIERS`
- `NEXT_PUBLIC_KODA_PLUGIN_TRUST_TIERS`

Both accept comma-separated values from: `official`, `verified`, `community`.

### 1.3 Plugin review criteria

A plugin is review-ready only when all items are satisfied:

1. **Policy metadata complete**
   - `policy.capabilityDeclarations` is non-empty and covers all runtime `capabilities`.
   - `policy.distributionVisibility` is explicit and duplicate-free.
   - `policy.trustTier` is one of supported trust tiers.
2. **Capability least-privilege**
   - Requested capabilities are only what the plugin requires.
   - Any write/modify capability has clear user-facing rationale.
3. **Distribution fit**
   - Visibility aligns to rollout and operational constraints.
   - Hosted exposure must be intentional (not implicit fallback).
4. **Operational readiness**
   - Launcher/API behavior on deny is user-actionable.
   - Audit logging emits policy decision metadata.

### 1.4 Escalation path

Use this escalation path for governance exceptions or production safety events:

1. **Triage (owner: Platform/Plugin on-call)**
   - Confirm deny/allow behavior and impacted plugin IDs.
   - Inspect `[plugin-policy-audit]` logs and policy metadata.
2. **Security + Product review (owner: Security reviewer + product owner)**
   - Decide whether event is misconfiguration, policy gap, or abuse risk.
3. **Mitigation decision (owner: engineering manager/designee)**
   - Apply temporary trust-tier override and/or plugin disable.
4. **Post-incident follow-up**
   - Capture root cause and final steady-state policy in roadmap issue notes.

## 2) Operator Playbook

## 2.1 Observability and evidence

Policy checks emit structured log lines prefixed with:

- `[plugin-policy-audit]`

Each event includes:

- `source` (`launcher` or `api`)
- `decision` (`allow` or `deny`)
- `code` (`PLUGIN_ALLOWED`, `PLUGIN_NOT_FOUND`, `PLUGIN_DISTRIBUTION_BLOCKED`, `PLUGIN_TRUST_TIER_BLOCKED`)
- `pluginId`, `distribution`, `trustTier`, and optional metadata

## 2.2 Temporary override procedure (trust-tier gate)

Use this when you need an immediate policy tighten/relax without changing code.

1. Pick target allowlist (for example, emergency lock to official only):
   - `KODA_PLUGIN_TRUST_TIERS=official`
2. Apply env change to deployment target.
3. Redeploy/restart runtime so env is reloaded.
4. Validate with launcher and one API route for affected plugin(s).
5. Confirm new audit events reflect expected allow/deny outcomes.

Notes:

- This is global for trust tiers, not plugin-by-plugin.
- Keep override lifetime short and tracked in incident notes.

## 2.3 Temporary plugin disable procedure (specific plugin)

Use this when one plugin must be blocked independent of trust tier.

1. Patch plugin policy metadata in code (catalog/definition):
   - remove current distribution from `distributionVisibility`, or
   - change trust tier to one blocked by current deployment allowlist.
2. Open emergency PR with incident context.
3. Run build validation and merge/deploy.
4. Confirm deny responses in launcher and API for that plugin.
5. Verify `[plugin-policy-audit]` deny events for the plugin ID.

## 2.4 Rollback procedure

When incident is resolved:

1. Revert trust-tier env override to baseline.
2. Revert plugin-specific disable patch (or ship corrected policy patch).
3. Redeploy and validate:
   - launcher can launch expected plugins
   - API routes pass policy gate for expected plugins
   - audit events return to expected `PLUGIN_ALLOWED` paths
4. Record final policy decision and owner sign-off.

## 3) Contributor Policy Compliance Checklist

Before opening a PR for plugin changes, contributors should confirm:

- [ ] `policy` metadata is present and schema-compliant.
- [ ] `policy.capabilityDeclarations` fully mirrors runtime `capabilities`.
- [ ] `distributionVisibility` explicitly documents rollout intent.
- [ ] `trustTier` matches maintainer review status.
- [ ] Local build passes and policy denials are tested for impacted paths.

See also: `docs/roadmap/phase-3-plugin-policy-schema.md` and `README.md` (Contributing).
