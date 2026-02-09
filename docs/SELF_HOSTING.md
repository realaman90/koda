# Self-Hosting Koda

Run Koda on your own machine with full local storage — no cloud accounts required beyond AI API keys.

## Prerequisites

| Requirement | Version | Check |
|------------|---------|-------|
| Node.js | 20+ | `node -v` |
| Docker | 20+ | `docker -v` |
| npm | 9+ | `npm -v` |

You'll also need API keys:

- **Anthropic** (required) — powers the animation AI agent. Get one at [console.anthropic.com](https://console.anthropic.com)
- **Fal.ai** (optional) — powers image/video generation nodes. Get one at [fal.ai](https://fal.ai). Skip this if you only need the animation plugin.

## Quick Start

```bash
# 1. Clone and enter the repo
git clone https://github.com/realaman90/koda.git
cd koda

# 2. Run the setup script (installs deps, builds sandbox, creates .env, runs DB migration)
chmod +x scripts/setup.sh
./scripts/setup.sh

# 3. Add your API keys to .env
#    Open .env and fill in ANTHROPIC_API_KEY (required) and FAL_KEY (optional)

# 4. Start Koda
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## What the Setup Script Does

`scripts/setup.sh` automates the full setup:

1. Installs Node.js dependencies (`npm install`)
2. Builds the Remotion sandbox Docker image (`koda/remotion-sandbox`)
3. Creates the Docker bridge network (`koda-sandbox-net`)
4. Copies `.env.example` to `.env` if it doesn't exist
5. Creates the `./data/` directory for local storage
6. Runs the database migration (`npm run db:migrate`)

You can also do each step manually — see [Manual Setup](#manual-setup) below.

## Architecture

```
┌────────────────────────────────────────────────┐
│  Browser (localhost:3000)                       │
│  ┌──────────────────────────────────────────┐  │
│  │  Next.js App (React Flow Canvas)         │  │
│  │  + Zustand state                         │  │
│  └──────────┬───────────────────────────────┘  │
└─────────────┼──────────────────────────────────┘
              │ HTTP
┌─────────────▼──────────────────────────────────┐
│  Next.js Server (Node.js)                       │
│  ┌────────────────┐  ┌──────────────────────┐  │
│  │  API Routes     │  │  Mastra AI Agent     │  │
│  │  /api/generate  │  │  (Anthropic Claude)  │  │
│  │  /api/assets    │  │                      │  │
│  └────────┬───────┘  └──────────┬───────────┘  │
│           │                     │               │
│  ┌────────▼───────┐  ┌─────────▼────────────┐  │
│  │  Local Storage  │  │  Docker Sandbox      │  │
│  │  ./data/        │  │  (Remotion + Chrome  │  │
│  │  ├── koda.db    │  │   + FFmpeg)          │  │
│  │  └── generations│  │  Ports 15173-15272   │  │
│  └────────────────┘  └──────────────────────┘  │
└────────────────────────────────────────────────┘
```

### Storage Layout

```
./data/
├── koda.db              # SQLite database (canvases, metadata)
└── generations/         # Uploaded + generated media files
    ├── manifest.json    # Asset index
    ├── img_abc123.png   # Uploaded images
    └── vid_xyz789.mp4   # Generated videos
```

All data stays on your machine. Nothing is sent to external services except:
- AI prompts to Anthropic (for the animation agent)
- Image/video generation requests to Fal.ai (if configured)

## Configuration

All configuration is in `.env`. The setup script creates this from `.env.example`.

### Required

```env
# Powers the animation AI agent (Claude)
ANTHROPIC_API_KEY=sk-ant-...
```

### Optional

```env
# Image/video generation (skip if you only need animation plugin)
FAL_KEY=...

# Storage backend: 'localStorage' or 'sqlite' (default: sqlite after setup)
NEXT_PUBLIC_STORAGE_BACKEND=sqlite

# SQLite database path
SQLITE_PATH=./data/koda.db

# Asset storage: 'local' (default — saves to disk)
ASSET_STORAGE=local
ASSET_LOCAL_PATH=./data/generations
```

### Sandbox Resource Limits

The animation sandbox runs Chromium + FFmpeg inside Docker. Tune for your hardware:

```env
# Memory per sandbox container (default: 1g)
SANDBOX_MEMORY=2g

# CPU cores per sandbox (default: 2)
SANDBOX_CPUS=4

# Custom Docker image names (if you build your own)
# SANDBOX_IMAGE_REMOTION=koda/remotion-sandbox
```

## Manual Setup

If you prefer to run each step yourself instead of using the setup script:

### 1. Install Dependencies

```bash
npm install
```

### 2. Build the Sandbox Docker Image

The animation plugin runs generated code in an isolated Docker container with Chromium, FFmpeg, and Remotion pre-installed.

```bash
docker build -t koda/remotion-sandbox ./templates/remotion-sandbox
```

This takes 2-5 minutes on first build (downloads ~1.5GB). Subsequent builds use Docker cache.

### 3. Create the Docker Network

Sandbox containers communicate over a bridge network:

```bash
docker network create koda-sandbox-net 2>/dev/null || true
```

### 4. Configure Environment

```bash
cp .env.example .env
# Edit .env — add your ANTHROPIC_API_KEY at minimum
```

### 5. Create Data Directory and Migrate

```bash
mkdir -p ./data/generations
npm run db:migrate
```

### 6. Start

```bash
npm run dev
```

## Updating

```bash
git pull
npm install
# Rebuild sandbox image if templates changed:
docker build -t koda/remotion-sandbox ./templates/remotion-sandbox
npm run db:migrate
npm run dev
```

Or use the update script:

```bash
./scripts/update.sh
```

## Running in Production

For production use (not just local dev):

```bash
# Build the Next.js app
npm run build

# Start in production mode
npm run start
```

Or use Docker Compose for the full stack:

```bash
docker compose up -d
```

The production port defaults to 3000. Set `PORT=8080` to change it.

## Troubleshooting

### "Docker is not running"

The animation plugin requires Docker. Start Docker Desktop or the Docker daemon:

```bash
# macOS
open -a Docker

# Linux
sudo systemctl start docker
```

### "Cannot connect to the Docker daemon"

On Linux, your user may need to be in the `docker` group:

```bash
sudo usermod -aG docker $USER
# Log out and back in, then retry
```

### Sandbox creation is slow

First sandbox creation downloads the Docker image layers (~1.5GB). After that, containers start in 1-2 seconds. If builds are slow:

```bash
# Pre-pull the base image
docker pull node:20-slim

# Rebuild with full cache
docker build -t koda/remotion-sandbox ./templates/remotion-sandbox
```

### "Port 3000 already in use"

```bash
# Use a different port
PORT=3001 npm run dev
```

### Clearing local data

```bash
# Reset everything (canvases, assets, database)
rm -rf ./data

# Re-run migration to recreate DB
npm run db:migrate
```

### Checking sandbox containers

```bash
# List running sandboxes
docker ps --filter name=koda-sandbox

# View logs for a sandbox
docker logs koda-sandbox-<name>

# Kill all sandboxes
docker rm -f $(docker ps -q --filter name=koda-sandbox) 2>/dev/null
```

## System Requirements

| | Minimum | Recommended |
|---|---------|-------------|
| CPU | 2 cores | 4+ cores |
| RAM | 4 GB | 8+ GB |
| Disk | 5 GB free | 10+ GB free |
| Docker | Required | Required |
| OS | macOS / Linux | macOS / Linux |

Windows is supported via WSL2 with Docker Desktop.

Each animation sandbox uses ~1GB RAM and 2 CPU cores by default. Running multiple animations concurrently will require more resources.
