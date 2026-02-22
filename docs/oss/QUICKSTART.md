# OSS Quickstart (Issue #44)

Fast path for clean-machine setup.

## Prerequisites

- Node.js 20+
- npm 9+
- Docker 20+ (required for animation sandbox)
- `ANTHROPIC_API_KEY` (required)

## Install

```bash
git clone https://github.com/Fastlanedevs/koda.git
cd koda
chmod +x scripts/setup.sh
./scripts/setup.sh
```

The setup script installs dependencies, bootstraps `.env`, builds sandbox image/network, and runs DB migration.

## Configure secrets

Open `.env` and set at minimum:

```env
ANTHROPIC_API_KEY=sk-ant-...
```

Optional generation providers:

```env
FAL_KEY=...
```

## Start app

```bash
npm run dev
```

Open `http://localhost:3000`.

## Next docs

- [Upgrade guide](./UPGRADE.md)
- [Troubleshooting](./TROUBLESHOOTING.md)
- [Known limits](./KNOWN_LIMITS.md)
- [Self-hosting deep guide](../SELF_HOSTING.md)
