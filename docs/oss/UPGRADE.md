# OSS Upgrade Guide (Issue #44)

## Standard upgrade path

```bash
git checkout main
git pull --ff-only
chmod +x scripts/update.sh
./scripts/update.sh
```

`update.sh` executes pull + setup automation + migration.

## Manual upgrade path

```bash
git pull --ff-only
npm install
docker build -t koda/remotion-sandbox ./templates/remotion-sandbox
npm run db:migrate
npm run build
npm run start
```

## Release-candidate validation requirement

Before adopting a new tag candidate, run OSS smoke checks:

```bash
npm run ci:oss-release-smoke -- --mode all --report reports/roadmap/phase4/<tag>-oss-smoke.json
```

See `docs/roadmap/phase-4-oss-release-readiness.md`.

## Rollback guidance

If upgrade fails:

1. Stop app.
2. Checkout previous known-good tag.
3. Restore DB backup (or snapshot) if migration is not backward-compatible.
4. Restart app and verify `/api/health`.
