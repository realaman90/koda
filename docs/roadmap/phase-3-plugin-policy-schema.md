# Phase 3 — Plugin Policy Schema Contract (Issue #40)

Defines the policy metadata contract required for plugin registration across OSS and Hosted distributions.

## 1) Policy Schema

All `AgentPlugin` definitions must include `policy` metadata:

```ts
policy: {
  capabilityDeclarations: AgentCapability[];
  distributionVisibility: ('oss' | 'hosted')[];
  trustTier: 'official' | 'verified' | 'community';
}
```

Validation rules enforced at plugin registration/load time:

- `capabilityDeclarations` must be non-empty.
- `distributionVisibility` must be non-empty and contain no duplicates.
- `trustTier` must be one of `official`, `verified`, `community`.
- Every runtime `capabilities[]` entry must be declared in `policy.capabilityDeclarations`.

Implementation:

- `src/lib/plugins/policy.ts`
- `src/lib/plugins/registry.ts` (`register()` calls policy validation)

## 2) Backfill for Existing Official Plugins

Official plugins were backfilled with explicit policy metadata:

- `animation-generator`
- `motion-analyzer`
- `storyboard-generator`
- `product-shot`

All are currently marked:

- `distributionVisibility: ['oss', 'hosted']`
- `trustTier: 'official'`

## 3) Migration Plan

For future plugin migrations:

1. Add `policy` block to plugin definition.
2. Mirror all runtime `capabilities` in `policy.capabilityDeclarations`.
3. Set distribution visibility per rollout strategy.
4. Set trust tier based on publisher verification level.
5. Registration should fail fast until policy schema validation passes.

This keeps plugin governance consistent across OSS and Hosted while preventing undeclared capability drift.

## 4) Governance + Operator References (Issue #42)

- Plugin governance and escalation playbook:
  - `docs/roadmap/phase-3-plugin-governance-playbook.md`
- Contributor metadata declaration guide:
  - `README.md` (Contributing)
  - `docs/roadmap/phase-3-plugin-governance-playbook.md` (Section 3)
