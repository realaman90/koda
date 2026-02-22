# Contributing to Koda (Issue #44)

Thanks for contributing.

## Workflow

1. Open/confirm an issue first for non-trivial work.
2. Create a branch from `main` using a scoped prefix:
   - `feat/<name>`
   - `fix/<name>`
   - `docs/<name>`
3. Keep PRs focused and linked to issue numbers.

## Issue conventions

Please include:

- Problem statement
- Scope / non-goals
- Reproduction steps (if bug)
- Acceptance criteria

Use roadmap label conventions when relevant: `roadmap`, plus domain (`backend`, `frontend`, `devops`, `documentation`) and priority (`p0/p1/p2`).

## PR conventions

- Title format example: `feat(scope): concise change summary (#123)`
- Include test/validation evidence in PR body
- Update docs/runbooks when behavior changes
- Keep migrations backward-compatible where possible

## Validation before PR

```bash
npm run lint
npm run build
```

Run additional targeted scripts for touched scope.

## Plugin policy requirement (mandatory)

All plugin definitions must provide policy metadata compliant with schema checks:

```ts
policy: {
  capabilityDeclarations: AgentCapability[];
  distributionVisibility: ('oss' | 'hosted')[];
  trustTier: 'official' | 'verified' | 'community';
}
```

And capability declarations must match runtime capability usage.

## Security + support

- Security disclosures: see [`SECURITY.md`](./SECURITY.md)
- OSS support scope: see [`docs/oss/KNOWN_LIMITS.md`](./docs/oss/KNOWN_LIMITS.md)
