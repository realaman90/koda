# OSS Known Limits (Issue #44)

## Distribution boundaries

- OSS includes plugin policy controls but does **not** include managed Hosted operations (on-call, SLA, managed incident response).
- Community plugins may be visible depending on trust-tier policy settings.

## Runtime limits

- Animation sandbox requires Docker; no Docker means animation plugin cannot render locally.
- Large media generations are constrained by local CPU/RAM and disk throughput.
- Local SQLite is single-node and intended for self-host/small-team scale.

## External dependencies

- AI generation requires third-party keys (Anthropic required; Fal optional for specific nodes).
- Provider outages or quota limits can reduce generation success.

## Support scope

- OSS support is best-effort through GitHub issues/discussions.
- No guaranteed response SLA for OSS.
- Security vulnerabilities should follow `SECURITY.md` (private disclosure path).
