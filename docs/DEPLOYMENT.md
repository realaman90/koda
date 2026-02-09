# Cloud Deployment Guide

Deploy Koda on **Vercel** (hosting) + **Turso** (database) + **Cloudflare R2** (asset storage) + **E2B** (animation sandboxes).

---

## 1. Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                         Vercel (Edge + Serverless)               │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐  │
│  │  Next.js App  │  │  API Routes  │  │  Animation Streaming   │  │
│  │  (Static +    │  │  /api/*      │  │  /api/plugins/         │  │
│  │   SSR Pages)  │  │              │  │  animation/stream      │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬─────────────┘  │
│         │                 │                      │                │
└─────────┼─────────────────┼──────────────────────┼────────────────┘
          │                 │                      │
    ┌─────▼─────┐    ┌─────▼──────┐         ┌─────▼──────┐
    │   Turso   │    │ Fal.ai API │         │    E2B     │
    │  (SQLite  │    │ (Image +   │         │ (Animation │
    │   Cloud)  │    │  Video     │         │  Sandboxes)│
    │           │    │  Gen)      │         │            │
    └───────────┘    └────────────┘         └────────────┘
                           │
                     ┌─────▼──────┐
                     │Cloudflare  │
                     │    R2      │
                     │ (Asset     │
                     │  Storage)  │
                     └────────────┘
```

**Data flow**: User interacts with canvas → Zustand state → API routes on Vercel → Fal.ai generates images/video → assets stored in R2 → canvas state persisted to Turso → animation code runs in E2B sandboxes.

---

## 2. Prerequisites

### Accounts Needed

| Service | Purpose | Signup |
|---------|---------|--------|
| **Vercel** | Hosting (Next.js) | [vercel.com](https://vercel.com) |
| **Turso** | Database (cloud SQLite) | [turso.tech](https://turso.tech) |
| **Cloudflare** | R2 asset storage | [cloudflare.com](https://cloudflare.com) |
| **E2B** | Animation sandboxes | [e2b.dev](https://e2b.dev) |
| **Fal.ai** | Image & video generation | [fal.ai](https://fal.ai) |
| **Anthropic** | AI agents (prompt enhancement) | [console.anthropic.com](https://console.anthropic.com) |

### Vercel Plan

**Pro plan recommended** ($20/user/month). The Hobby plan has a 10-second function timeout which is far too short for AI generation routes (image gen takes 10-60s, video gen takes 30-120s, animation streaming takes 60-300s). Pro plan with Fluid Compute supports up to 800 seconds.

---

## 3. Cloud Services Setup

### 3a. Turso (Database)

Turso is a cloud-hosted SQLite service built on libSQL. It replaces the local `better-sqlite3` database.

**Why not local SQLite on Vercel?** The `better-sqlite3` package is a native Node.js module that fails on Vercel's serverless runtime — there's no persistent filesystem and native binary loading is unreliable across cold starts.

#### Steps

1. **Install Turso CLI**:
   ```bash
   # macOS
   brew install tursodatabase/tap/turso

   # Linux / WSL
   curl -sSfL https://get.tur.so/install.sh | bash
   ```

2. **Sign up and create a database**:
   ```bash
   turso auth signup          # or: turso auth login
   turso db create koda       # creates a database named "koda"
   ```

3. **Get connection credentials**:
   ```bash
   turso db show koda --url   # → libsql://koda-<your-org>.turso.io
   turso db tokens create koda # → eyJhbGciOi...
   ```

4. **Run migrations** (do this locally before your first deploy):
   ```bash
   TURSO_DATABASE_URL=libsql://koda-<your-org>.turso.io \
   TURSO_AUTH_TOKEN=<your-token> \
   npm run db:migrate
   ```
   This runs `tsx src/lib/db/migrate.ts` which applies the schema from `src/lib/db/schema.ts`.

### 3b. Cloudflare R2 (Asset Storage)

R2 stores generated images, videos, and audio so they persist beyond Fal.ai's 24-48h URL expiry.

**Why R2 over S3?** Zero egress fees — downloading assets (the most common operation) is free. The API is S3-compatible, so switching later is trivial.

#### Steps

1. **Create an R2 bucket**:
   - Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → R2 → Create Bucket
   - Name it `koda-assets` (or any name you prefer)
   - Choose a location hint closest to your users

2. **Generate S3-compatible API credentials**:
   - R2 → Manage R2 API tokens → Create API Token
   - Permissions: Object Read & Write
   - Scope: limit to your bucket
   - Save the **Access Key ID** and **Secret Access Key**

3. **Get your Account ID**:
   - It's in the Cloudflare dashboard URL: `https://dash.cloudflare.com/<account-id>`
   - Or: R2 overview page shows it

4. **(Optional) Set up a custom domain** for public asset URLs:
   - R2 bucket settings → Custom Domains → Add domain
   - Alternatively, enable the free `r2.dev` subdomain for testing

5. **(Optional) Configure CORS** if assets are loaded from a different domain:
   - R2 bucket → Settings → CORS Policy
   - Allow your Vercel deployment domain(s)

### 3c. E2B (Animation Sandboxes)

E2B provides cloud sandboxes for running animation code (Theatre.js, Remotion) without needing Docker on the host.

#### Steps

1. **Create an account** at [e2b.dev](https://e2b.dev)
2. **Get your API key** from the E2B dashboard
3. Set environment variables:
   ```
   SANDBOX_PROVIDER=e2b
   E2B_API_KEY=<your-key>
   ```

The sandbox provider abstraction (`src/lib/sandbox/types.ts`) handles the switch between Docker (local) and E2B (cloud) transparently.

### 3d. Fal.ai + Anthropic

1. **Fal.ai**: Get your API key at [fal.ai/dashboard](https://fal.ai/dashboard/keys) → `FAL_KEY`
2. **Anthropic**: Get your API key at [console.anthropic.com](https://console.anthropic.com/settings/keys) → `ANTHROPIC_API_KEY`

---

## 4. Vercel Deployment — Step by Step

### 1. Connect your repository

- Go to [vercel.com/new](https://vercel.com/new)
- Import your GitHub repository
- Framework preset: **Next.js** (auto-detected)

### 2. Configure build settings

The defaults work out of the box:
- **Build command**: `npm run build`
- **Output directory**: `.next`
- **Install command**: `npm install`

To run database migrations on every deploy, change the build command to:
```
npm run db:migrate && npm run build
```

### 3. Set environment variables

In the Vercel dashboard: Project → Settings → Environment Variables.

Add all variables from [Section 6](#6-environment-variables-reference) below.

### 4. Deploy

Click **Deploy**. Vercel will build and deploy automatically. Future pushes to your main branch trigger automatic deployments.

---

## 5. Vercel Configuration

Critical settings to ensure AI generation and animation routes work properly.

### 5a. Enable Fluid Compute

Fluid Compute allows functions to reuse compute resources across invocations and extends the maximum execution time.

1. Go to: **Project Settings → Functions → Fluid Compute**
2. Toggle it **ON**

With Fluid Compute on Pro plan:
- **Default duration**: 300 seconds (5 min)
- **Maximum duration**: 800 seconds (~13 min)
- Functions share CPU/memory across concurrent invocations

### 5b. Set `maxDuration` on Long-Running Routes

AI generation routes need longer timeouts than Vercel's default 10s (Hobby) or 15s (Pro without Fluid). Add `maxDuration` exports to route files:

| Route | `maxDuration` | Why |
|-------|--------------|-----|
| `/api/generate` | 300 | Fal.ai image generation (polling) |
| `/api/generate-video` | 300 | Fal.ai video generation (polling, slower) |
| `/api/generate-video-audio` | 300 | Video + audio generation |
| `/api/generate-speech` | 300 | Speech synthesis |
| `/api/generate-music` | 300 | Music generation |
| `/api/agents/enhance-prompt` | 60 | Anthropic prompt enhancement |
| `/api/plugins/animation/stream` | 300 | Animation agent SSE streaming |
| `/api/plugins/animation` | 300 | Animation finalization |
| `/api/plugins/storyboard` | 120 | Storyboard generation |

Already configured in the codebase:
- `src/app/api/plugins/animation/stream/route.ts` — `maxDuration = 120` (consider increasing to 300)
- `src/app/api/plugins/storyboard/route.ts` — `maxDuration = 120`

Add to routes that are missing it:
```typescript
// Add at the top of each route file, after imports
export const maxDuration = 300;
```

Routes that need this export added:
- `src/app/api/generate/route.ts`
- `src/app/api/generate-video/route.ts`
- `src/app/api/generate-video-audio/route.ts`
- `src/app/api/generate-speech/route.ts`
- `src/app/api/generate-music/route.ts`
- `src/app/api/agents/enhance-prompt/route.ts`
- `src/app/api/plugins/animation/route.ts`

### 5c. Set `dynamic = 'force-dynamic'` on SSE Routes

Server-Sent Events (SSE) routes must not be cached. Add:

```typescript
export const dynamic = 'force-dynamic';
```

Already configured:
- `src/app/api/plugins/animation/stream/route.ts`
- `src/app/api/plugins/storyboard/route.ts`
- `src/app/api/plugins/animation/sandbox/[sandboxId]/proxy/[[...path]]/route.ts`

### 5d. Function Memory

Default allocation is **1 vCPU / 2 GB RAM**, which is sufficient for most routes. If you experience OOM errors on animation or generation routes, increase to 2 vCPU / 4 GB in Project Settings → Functions → Function Memory.

### 5e. Environment Variables

Complete list for cloud deployment — set all of these in Vercel dashboard:

```
# AI Generation
FAL_KEY=<your-fal-key>
ANTHROPIC_API_KEY=<your-anthropic-key>

# Canvas Storage (Turso)
NEXT_PUBLIC_STORAGE_BACKEND=sqlite
TURSO_DATABASE_URL=libsql://koda-<your-org>.turso.io
TURSO_AUTH_TOKEN=<your-turso-token>

# Asset Storage (R2)
ASSET_STORAGE=r2
R2_ACCOUNT_ID=<your-cloudflare-account-id>
R2_ACCESS_KEY_ID=<your-r2-access-key>
R2_SECRET_ACCESS_KEY=<your-r2-secret-key>
R2_BUCKET_NAME=koda-assets
R2_PUBLIC_URL=<optional-custom-domain-or-r2-dev-url>

# Animation Sandboxes (E2B)
SANDBOX_PROVIDER=e2b
E2B_API_KEY=<your-e2b-key>
```

### 5f. Vercel Limitations

Be aware of these constraints:

| Limitation | Impact | Mitigation |
|-----------|--------|------------|
| No persistent filesystem | Can't use local SQLite or local asset storage | Use Turso + R2 |
| No Docker | Can't run self-hosted animation sandboxes | Use E2B |
| Cold starts | First request after idle period is slow (~1-3s) | Fluid Compute reduces this with connection reuse |
| 4.5 MB request body limit | Large image uploads may fail | Upload to R2 directly, pass URL to API |
| Response streaming timeout | SSE connections may drop at `maxDuration` | Set adequate `maxDuration`, handle reconnects client-side |
| `better-sqlite3` won't build | Native module incompatible with serverless | Listed in `serverExternalPackages` in `next.config.ts`, use Turso for actual DB |

---

## 6. Environment Variables Reference

| Variable | Required | Service | Description |
|----------|----------|---------|-------------|
| `FAL_KEY` | Yes | Fal.ai | API key for image/video/audio generation |
| `ANTHROPIC_API_KEY` | Yes | Anthropic | API key for AI agents (prompt enhancement) |
| `NEXT_PUBLIC_STORAGE_BACKEND` | Yes | App | Set to `sqlite` for persistent storage |
| `TURSO_DATABASE_URL` | Yes | Turso | Database URL (`libsql://...turso.io`) |
| `TURSO_AUTH_TOKEN` | Yes | Turso | Authentication token |
| `ASSET_STORAGE` | Yes | App | Set to `r2` for cloud asset storage |
| `R2_ACCOUNT_ID` | Yes | Cloudflare | Your Cloudflare account ID |
| `R2_ACCESS_KEY_ID` | Yes | Cloudflare | R2 S3-compatible access key |
| `R2_SECRET_ACCESS_KEY` | Yes | Cloudflare | R2 S3-compatible secret key |
| `R2_BUCKET_NAME` | Yes | Cloudflare | R2 bucket name (e.g., `koda-assets`) |
| `R2_ENDPOINT` | No | Cloudflare | Custom endpoint for jurisdiction-specific buckets (e.g., EU) |
| `R2_PUBLIC_URL` | No | Cloudflare | Custom domain or r2.dev URL for public access |
| `SANDBOX_PROVIDER` | Yes* | App | Set to `e2b` for cloud sandboxes (*only if using animation) |
| `E2B_API_KEY` | Yes* | E2B | API key (*only if using animation) |

---

## 7. Database Migrations

The schema lives in `src/lib/db/schema.ts`. Migrations are generated by Drizzle Kit and applied by the migration script.

### Run migrations locally against Turso

```bash
TURSO_DATABASE_URL=libsql://koda-<your-org>.turso.io \
TURSO_AUTH_TOKEN=<your-token> \
npm run db:migrate
```

### Run migrations as part of Vercel build

Update your Vercel build command to:
```
npm run db:migrate && npm run build
```

This ensures the schema is always up to date on every deploy.

### Generate new migrations (after schema changes)

```bash
npm run db:generate   # generates SQL in ./drizzle/
npm run db:migrate    # applies to database
```

---

## 8. Post-Deployment Verification

After deploying, verify everything works:

### 1. Check storage configuration
```bash
curl https://your-app.vercel.app/api/config | jq
```
Expected response should show:
- `flags.isCloud: true`
- `flags.hasCloudDb: true`
- `flags.hasCloudAssets: true`
- `flags.assetsConfigured: true`

### 2. Test image generation
- Open the app, add an ImageGeneratorNode
- Enter a prompt and generate
- Verify the image appears and the URL points to R2 (or your custom domain)

### 3. Test prompt enhancement
- Click the enhance/magic prompt button on a generation node
- Verify the enhanced prompt returns (uses Anthropic API)

### 4. Verify asset persistence
- Generate an image
- Refresh the page
- The image should still load (stored in R2, not a temporary Fal.ai URL)

### 5. Verify canvas persistence
- Create some nodes and connections
- Refresh the page
- Everything should restore from Turso

### 6. Test animation (if using E2B)
- Create an AnimationGeneratorNode
- Run a generation
- Verify the sandbox spins up and renders

---

## 9. Cost Estimation

| Service | Free Tier | Pro Tier | Notes |
|---------|-----------|----------|-------|
| **Vercel** | Hobby: 10s timeout (unusable) | **$20/user/mo** — 1M invocations, 1000 GB-hr compute, 1TB bandwidth | Pro required for AI gen timeouts |
| **Turso** | 500 databases, 9 GB storage, 25M row reads/mo | $29/mo — unlimited reads, 50 GB storage | Free tier is generous for most use cases |
| **Cloudflare R2** | 10 GB storage, 10M Class B ops, 1M Class A ops/mo | $0.015/GB/mo storage, $0.36/M Class A ops | Zero egress fees always |
| **E2B** | Limited free tier | Usage-based (sandbox runtime hours) | Only needed for animation feature |
| **Fal.ai** | — | Pay per generation ($0.002-$0.10+ per image depending on model) | Cost scales with usage |
| **Anthropic** | — | Pay per token (~$3/M input, ~$15/M output for Claude Sonnet) | Used for prompt enhancement |

**Estimated monthly cost for light usage** (solo developer, ~100 generations/day):
- Vercel Pro: $20
- Turso: $0 (free tier)
- R2: $0 (free tier)
- Fal.ai: ~$10-30
- Anthropic: ~$1-5
- **Total: ~$31-55/month**

---

## 10. Alternatives to Vercel

For workloads where Vercel's serverless model is limiting — long-running animation rendering, WebSocket needs, or cost concerns at scale.

### Coolify (Self-Hosted PaaS) — Recommended Alternative

[Coolify](https://coolify.io) is an open-source, self-hosted PaaS you can run on any VPS.

**Pros**:
- Deploy on Hetzner ($5-20/mo), DigitalOcean, or any VPS
- Git-push deploy, preview URLs, automatic SSL
- Full Docker support — run animation sandboxes directly (no E2B needed)
- 10-20% of Vercel's cost at similar scale
- No function timeouts or cold starts

**Cons**:
- You manage the server (updates, monitoring, backups)
- No built-in edge network (single region unless you set up multiple)

**When to use**: You want full control, lower costs, or need Docker for animation sandboxes without E2B.

### Railway

[Railway](https://railway.com) is a container-based deployment platform.

**Pros**:
- Predictable pricing ($5/mo + usage)
- Supports long-running processes and persistent connections
- Good developer experience, similar workflow to Vercel
- Built-in databases (Postgres, Redis)

**Cons**:
- No built-in edge/CDN (pair with Cloudflare)
- Smaller ecosystem than Vercel

**When to use**: You want Vercel-like DX without serverless limitations.

### Fly.io

[Fly.io](https://fly.io) runs VMs at edge locations worldwide.

**Pros**:
- Persistent compute — no cold starts
- Runs at edge locations for low latency
- Best for WebSockets, SSE, and real-time features
- Volume support for local SQLite (no Turso needed)

**Cons**:
- More ops knowledge needed
- Pricing can be complex

**When to use**: You need persistent connections, real-time features, or edge-deployed SQLite.

### Comparison

| Feature | Vercel | Coolify | Railway | Fly.io |
|---------|--------|---------|---------|--------|
| Deployment | Git push | Git push | Git push | CLI / Git |
| Compute model | Serverless | Container/VM | Container | VM |
| Max request duration | 800s (Pro + Fluid) | Unlimited | Unlimited | Unlimited |
| Docker support | No | Yes | Yes | Yes |
| Cold starts | Yes | No | Minimal | No |
| Managed infra | Yes | Self-managed | Yes | Yes |
| Cost (light use) | ~$20/mo | ~$5-10/mo (VPS) | ~$10-15/mo | ~$10-15/mo |
| Edge/CDN | Built-in | BYO (Cloudflare) | BYO | Built-in |

---

## 11. Troubleshooting

### `better-sqlite3` errors on Vercel

**Symptom**: Build fails with native module errors or runtime crashes referencing `better-sqlite3`.

**Fix**: This is expected — `better-sqlite3` can't run on Vercel's serverless runtime. The app is configured to handle this:
- `next.config.ts` lists it in `serverExternalPackages` so webpack doesn't try to bundle it
- When `TURSO_DATABASE_URL` is set, the app uses `@libsql/client` instead of `better-sqlite3`
- Ensure `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` are set in Vercel environment variables

### Function timeout errors

**Symptom**: API routes return 504 or "FUNCTION_INVOCATION_TIMEOUT".

**Fix**:
1. Enable Fluid Compute (Project Settings → Functions)
2. Verify `maxDuration` is exported in the failing route file
3. Check that your Vercel plan supports the duration you've set (Pro: up to 800s)

### R2 "Access Denied" errors

**Symptom**: Assets fail to upload or return 403.

**Fix**:
1. Verify R2 API token has Object Read & Write permissions
2. Check the token is scoped to the correct bucket
3. Verify `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, and `R2_BUCKET_NAME` are all set
4. If loading assets from the browser, check CORS policy on the R2 bucket

### Turso connection refused

**Symptom**: Database operations fail with connection errors.

**Fix**:
1. Verify URL format: must start with `libsql://` (not `https://`)
2. Check auth token is valid: `turso db tokens create koda`
3. Verify the database exists: `turso db list`
4. Check Turso service status at [status.turso.tech](https://status.turso.tech)

### SSE not streaming (animation)

**Symptom**: Animation streaming endpoint returns all at once or times out.

**Fix**:
1. Verify `export const dynamic = 'force-dynamic'` is in the route file
2. Check `maxDuration` is set high enough (300s recommended)
3. Vercel's infrastructure may buffer responses — this is normal for small chunks
4. Ensure Fluid Compute is enabled for better streaming performance

### Cold start latency

**Symptom**: First request after idle period takes 3-10 seconds.

**Fix**:
- Enable Fluid Compute — it reuses connections across invocations
- Vercel Pro with Fluid Compute significantly reduces cold start frequency
- For zero cold starts, consider alternatives like Fly.io or Railway

### Assets disappear after 24-48 hours

**Symptom**: Generated images/videos show broken links after a day or two.

**Fix**: You're using Fal.ai's temporary URLs instead of persistent storage.
1. Set `ASSET_STORAGE=r2` in environment variables
2. Configure all R2 credentials
3. Re-generate affected assets
