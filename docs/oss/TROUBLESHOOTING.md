# OSS Troubleshooting (Issue #44)

## Setup script fails on Docker build

Symptoms: `docker build` errors during `scripts/setup.sh`.

Actions:

1. Ensure Docker daemon is running.
2. Retry only setup parts you need:
   ```bash
   ./scripts/setup.sh --skip-install
   ```
3. If you do not use animation sandbox locally, skip image build:
   ```bash
   ./scripts/setup.sh --skip-sandbox --skip-network
   ```

## App boots but APIs fail with DB errors

1. Verify SQLite path in `.env`:
   ```env
   SQLITE_PATH=./data/koda.db
   ```
2. Re-run migration:
   ```bash
   npm run db:migrate
   ```
3. Confirm `./data/` is writable.

## Sandbox creation fails at runtime

1. Check Docker network exists:
   ```bash
   docker network ls | grep koda-sandbox-net
   ```
2. Recreate network and rebuild image:
   ```bash
   docker network create koda-sandbox-net || true
   docker build -t koda/remotion-sandbox ./templates/remotion-sandbox
   ```

## Port already in use

Use a different port:

```bash
PORT=3100 npm run dev
```

## Need a complete reset

```bash
rm -rf .next
npm run db:migrate
npm run dev
```

> Keep `./data/` unless you intentionally want to remove local canvases/assets.
