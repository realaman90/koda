# Phase 0 — Weekly Launch Scorecard Template (Issue #33)

> Reporting cadence: weekly (Monday 09:00 UTC)

## Owners

- **Program owner:** Product + Engineering lead
- **Data owner:** Platform engineering
- **Channel owner:** Growth / GTM

## Launch Gate Thresholds

| KPI | Owner | Baseline (OSS) | Baseline (Hosted) | Launch threshold | Status |
| --- | --- | ---: | ---: | ---: | --- |
| Signup completion success rate | Growth | _fill_ | _fill_ | **>= 95%** | ⬜ |
| Workspace bootstrap success rate | Platform | _fill_ | _fill_ | **>= 98%** | ⬜ |
| Plugin execution success rate | AI Platform | _fill_ | _fill_ | **>= 92%** | ⬜ |
| Overall API error rate | Platform | _fill_ | _fill_ | **<= 3%** | ⬜ |

## Data Source Ownership

| KPI | Primary source | Collection owner | Query/filter |
| --- | --- | --- | --- |
| Signup completion success rate | Clerk webhook logs (`/api/webhooks/clerk`) | Platform | `[launch-metric]` + `metric=signup_completion` |
| Workspace bootstrap success rate | API logs (`/api/workspaces/bootstrap`) | Platform | `[launch-metric]` + `metric=workspace_bootstrap` |
| Plugin execution success rate | Plugin API logs (`/api/plugins/*`) | AI Platform | `[launch-metric]` + `metric=plugin_execution` |
| Overall API error rate | Aggregated launch metric logs | Platform | all `[launch-metric]` where `status=error` / total |

## Update Workflow

1. Export logs for the reporting window into a file (e.g. `reports/launch-metrics-YYYY-MM-DD.log`).
2. Run:
   ```bash
   npm run roadmap:baseline -- reports/launch-metrics-YYYY-MM-DD.log
   ```
3. Copy output into the weekly section and update gate status.
