# Deploying Koda

Koda supports two deployment modes. Pick the one that fits your needs.

| | Self-Hosted | Cloud |
|---|---|---|
| **Where** | Your machine / VPS | Vercel + managed services |
| **Storage** | Local SQLite + disk | Turso (DB) + Cloudflare R2 (assets) |
| **Sandboxes** | Docker containers | E2B cloud sandboxes |
| **Cost** | Free (+ AI API keys) | ~$0 on free tiers, scales with usage |
| **Best for** | Local dev, privacy, air-gapped | Teams, sharing, production |
| **Status** | Ready | In progress (see [Roadmap](#cloud-roadmap)) |

---

## Option 1: Self-Hosted (Local)

Everything runs on your machine. No cloud accounts needed beyond AI API keys.

```
┌─────────────────────────────────────────┐
│  Your Machine                            │
│                                          │
│  Next.js App (:3000)                     │
│    ├── SQLite DB    → ./data/koda.db     │
│    ├── Asset files  → ./data/generations │
│    └── Docker sandboxes (Remotion)       │
│         └── Chromium + FFmpeg + Bun      │
└─────────────────────────────────────────┘
```

### Quick Start

```bash
git clone https://github.com/realaman90/koda.git
cd koda
./scripts/setup.sh    # installs deps, builds sandbox image, configures env
# Add API keys to .env
npm run dev
```

### What You Need

- Node.js 20+
- Docker (for animation sandboxes)
- `ANTHROPIC_API_KEY` (required — powers the AI agent)
- `FAL_KEY` (optional — for image/video generation nodes)

### Key `.env` Settings

```env
ANTHROPIC_API_KEY=sk-ant-...
FAL_KEY=...                              # optional

NEXT_PUBLIC_STORAGE_BACKEND=sqlite
SQLITE_PATH=./data/koda.db
ASSET_STORAGE=local
ASSET_LOCAL_PATH=./data/generations
```

### Production (Docker Compose)

```bash
# Build sandbox image first
docker build -t koda/remotion-sandbox ./templates/remotion-sandbox

# Start the full stack
docker compose up -d
```

Full details: **[Self-Hosting Guide](./SELF_HOSTING.md)**

---

## Option 2: Cloud

Deploy the Next.js app to Vercel (or any Node.js host) with managed backend services.

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   Vercel      │    │  Turso       │    │  Cloudflare  │
│   (Next.js)   │───▶│  (SQLite DB) │    │  R2 (assets) │
│               │    │  Edge replicas│    │  Free egress │
└──────┬───────┘    └──────────────┘    └──────────────┘
       │
       ▼
┌──────────────┐
│  E2B         │
│  (Sandboxes) │
│  Cloud VMs   │
└──────────────┘
```

### Services

| Service | Purpose | Free Tier | Docs |
|---------|---------|-----------|------|
| [Vercel](https://vercel.com) | Next.js hosting | Hobby plan | [vercel.com/docs](https://vercel.com/docs) |
| [Turso](https://turso.tech) | SQLite database (edge-replicated) | 9GB, 500 DBs | [docs.turso.tech](https://docs.turso.tech) |
| [Cloudflare R2](https://developers.cloudflare.com/r2/) | Asset storage (images, videos) | 10GB, zero egress fees | [R2 docs](https://developers.cloudflare.com/r2/) |
| [E2B](https://e2b.dev) | Cloud sandboxes (code execution) | 100 hrs/mo | [e2b.dev/docs](https://e2b.dev/docs) |

### Key `.env` Settings

```env
ANTHROPIC_API_KEY=sk-ant-...
FAL_KEY=...

# Database — Turso
NEXT_PUBLIC_STORAGE_BACKEND=sqlite
TURSO_DATABASE_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=your-token

# Assets — Cloudflare R2
ASSET_STORAGE=r2
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=koda-assets

# Sandboxes — E2B (coming soon)
# E2B_API_KEY=...
```

### Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

Add your environment variables in the Vercel dashboard under **Settings > Environment Variables**.

---

## Cloud Roadmap

The cloud deployment is being built incrementally. Current status:

| Component | Status | Notes |
|-----------|--------|-------|
| Vercel deployment | Ready | Standard Next.js deploy |
| Turso (database) | Ready | Drop-in replacement for local SQLite |
| R2 (asset storage) | Ready | `ASSET_STORAGE=r2` — upload/serve via S3 API |
| E2B (sandboxes) | In progress | Replacing Docker containers with cloud VMs |
| Sandbox persistence | In progress | R2 code snapshots + sandbox resurrection |
| Media pipeline (R2) | In progress | Upload to R2 first, pass URLs to sandbox |

### What's Changing for E2B

Currently, animation sandboxes are Docker containers on the same machine. For cloud deployment, these will be replaced with [E2B](https://e2b.dev) cloud sandboxes:

- **Docker provider** → **E2B provider** (same `SandboxProvider` interface)
- **`writeBinary()` via stdin** → **E2B `filesystem.write()` API**
- **Media as Buffers in RequestContext** → **Media uploaded to R2, URLs passed to E2B**
- **Sandbox dies on restart** → **Code snapshots in R2, transparent resurrection**

The `RequestContext` pattern and tool auto-resolution stay the same — only the transport layer changes.

### What Works Today in Cloud

Even before E2B is complete, you can deploy to Vercel with Turso + R2 for everything except the animation plugin:

- Canvas editor (nodes, edges, connections)
- Image generation (Fal.ai)
- Video generation (Fal.ai)
- Text nodes, media upload, presets
- Asset storage (R2)
- Multi-canvas support (Turso)

The animation plugin specifically requires Docker or E2B for code execution sandboxes.

---

## Comparison

| Feature | Self-Hosted | Cloud |
|---------|-------------|-------|
| Setup time | ~5 min | ~15 min |
| Data location | Your disk | Turso + R2 |
| Collaboration | Single user | Multi-user ready |
| Animation sandboxes | Docker (local) | E2B (cloud VMs) |
| Scaling | Limited by your hardware | Auto-scales |
| Offline support | Full (except AI calls) | No |
| Cost | $0 + AI API usage | $0 free tier + AI API usage |
| Privacy | Data never leaves your machine | Data in managed services |
