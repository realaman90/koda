# Phase 0 Baseline Snapshot — 2026-02-22 (Issue #33)

Baseline generated for initial roadmap kickoff using launch metric instrumentation.

- Capture command: `npm run roadmap:baseline -- reports/launch-metrics-phase0-kickoff.log`
- Measurement type: pre-launch smoke baseline (OSS + Hosted environments)

## Baseline KPIs

| Deployment | Signup completion | Workspace bootstrap | Plugin execution | Overall error rate |
| --- | ---: | ---: | ---: | ---: |
| OSS | 100.00% (8/8) | 100.00% (10/10) | 90.00% (18/20) | 7.89% |
| Hosted | 100.00% (8/8) | 90.00% (9/10) | 95.00% (19/20) | 6.32% |

## Notes

- These values establish the **starting point** for Phase 0 launch gating.
- Weekly scorecard updates should use the template at:
  - `docs/roadmap/phase-0-launch-scorecard-template.md`
- KPI ownership and source mapping are defined in the same scorecard template.
