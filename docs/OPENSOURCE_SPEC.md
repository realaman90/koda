# Koda Animation Plugin - Open Source Spec

## Overview

This document outlines the strategy for open-sourcing the Koda Animation Plugin as a self-hostable Docker image that users can run locally or deploy to cloud providers.

---

## 1. Project Scope

### What We're Open-Sourcing

```
┌─────────────────────────────────────────────────────────────────┐
│                    KODA ANIMATION PLUGIN                        │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │ Web UI      │  │ API Server  │  │ Sandbox Runtime         │  │
│  │ (Next.js)   │──│ (Mastra)    │──│ (Docker-in-Docker)      │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
│                                                                  │
│  Features:                                                       │
│  • Node-based canvas editor                                      │
│  • AI-powered animation generation (Theatre.js + Remotion)       │
│  • Live preview with hot reload                                  │
│  • Video rendering (FFmpeg)                                      │
│  • Multi-agent orchestration                                     │
└─────────────────────────────────────────────────────────────────┘
```

### Core Components

| Component | Description | Open Source |
|-----------|-------------|-------------|
| Canvas UI | React Flow-based node editor | ✅ Yes |
| Animation Node | Chat-based animation generator | ✅ Yes |
| Mastra Agents | Orchestrator + Code generators | ✅ Yes |
| Docker Sandbox | Isolated execution environment | ✅ Yes |
| Theatre.js Template | 3D animation sandbox | ✅ Yes |
| Remotion Template | 2D animation sandbox | ✅ Yes |

---

## 2. Distribution Strategy

### 2.1 Docker Image Architecture

We'll provide a **single Docker image** that contains everything needed to run Koda:

```
┌──────────────────────────────────────────────────────────────┐
│                    koda/koda:latest                          │
├──────────────────────────────────────────────────────────────┤
│  Base: node:20-slim                                          │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ /app (Next.js Application)                             │  │
│  │  ├── .next/          (production build)                │  │
│  │  ├── public/         (static assets)                   │  │
│  │  └── node_modules/   (dependencies)                    │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ /templates (Sandbox Templates)                         │  │
│  │  ├── theatre/        (Theatre.js + R3F)                │  │
│  │  └── remotion/       (Remotion)                        │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ /sandbox-images (Pre-built Sandbox Images)             │  │
│  │  ├── koda-sandbox-theatre.tar                          │  │
│  │  └── koda-sandbox-remotion.tar                         │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  Installed:                                                  │
│  • Node.js 20                                                │
│  • Docker CLI (for DinD)                                     │
│  • FFmpeg (fallback rendering)                               │
└──────────────────────────────────────────────────────────────┘
```

### 2.2 Sandbox Images (Separate)

Pre-built sandbox images for faster startup:

```
koda/sandbox-theatre:latest    (~2.5GB)
├── Node.js 20 + Bun
├── Chromium + Puppeteer
├── FFmpeg
├── Theatre.js + React Three Fiber + Drei
└── Pre-installed node_modules

koda/sandbox-remotion:latest   (~2.2GB)
├── Node.js 20 + Bun
├── Chromium + Puppeteer
├── FFmpeg
├── Remotion + @remotion/cli
└── Pre-installed node_modules
```

### 2.3 Image Tags

```
koda/koda:latest          # Latest stable
koda/koda:1.0.0           # Semantic versioned
koda/koda:main            # Latest from main branch
koda/koda:dev             # Development builds

koda/sandbox-theatre:latest
koda/sandbox-remotion:latest
```

---

## 3. Configuration

### 3.1 Environment Variables

```bash
# Required
ANTHROPIC_API_KEY=sk-ant-...        # Claude API key (Opus + Haiku)

# Optional - AI Providers
OPENAI_API_KEY=sk-...               # Fallback LLM
FAL_KEY=...                         # Image/video generation (existing nodes)

# Optional - Storage (for persistent videos)
R2_ACCOUNT_ID=...                   # Cloudflare R2
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=koda-outputs
R2_PUBLIC_URL=https://...           # Public URL for videos

# Or use S3-compatible storage
S3_ENDPOINT=...
S3_ACCESS_KEY=...
S3_SECRET_KEY=...
S3_BUCKET=...
S3_REGION=...

# Optional - Server Config
PORT=3000                           # Web server port
SANDBOX_PORT_START=15173            # Sandbox port range start
SANDBOX_PORT_END=15272              # Sandbox port range end (100 sandboxes)
SANDBOX_IDLE_TIMEOUT=1800000        # 30 min idle cleanup
SANDBOX_MAX_MEMORY=2g               # Per-sandbox memory limit
SANDBOX_MAX_CPUS=2                  # Per-sandbox CPU limit

# Optional - Security
KODA_AUTH_ENABLED=false             # Enable basic auth
KODA_AUTH_USERNAME=admin
KODA_AUTH_PASSWORD=...
KODA_ALLOWED_ORIGINS=*              # CORS origins

# Optional - Telemetry
KODA_TELEMETRY=false                # Anonymous usage stats
```

### 3.2 Configuration File

Support a `koda.config.yaml` for advanced configuration:

```yaml
# koda.config.yaml
version: 1

server:
  port: 3000
  host: 0.0.0.0

sandbox:
  provider: docker              # docker | e2b (future)
  portRange:
    start: 15173
    end: 15272
  limits:
    memory: 2g
    cpus: 2
    timeout: 1800000           # 30 min
  templates:
    theatre: /templates/theatre
    remotion: /templates/remotion

storage:
  provider: local              # local | r2 | s3
  local:
    path: /data/outputs
  r2:
    accountId: ${R2_ACCOUNT_ID}
    accessKeyId: ${R2_ACCESS_KEY_ID}
    secretAccessKey: ${R2_SECRET_ACCESS_KEY}
    bucket: ${R2_BUCKET_NAME}
    publicUrl: ${R2_PUBLIC_URL}

ai:
  anthropic:
    apiKey: ${ANTHROPIC_API_KEY}
    orchestratorModel: claude-opus-4-5-20251101
    codegenModel: claude-haiku-4-5-20251001
  openai:
    apiKey: ${OPENAI_API_KEY}
  fal:
    apiKey: ${FAL_KEY}

features:
  imageGeneration: true        # Enable image nodes
  videoGeneration: true        # Enable video nodes
  animationGeneration: true    # Enable animation node
  maxConcurrentSandboxes: 10   # Limit concurrent animations
```

---

## 4. Deployment Options

### 4.1 Local Development (Docker Compose)

```yaml
# docker-compose.yml
version: '3.8'

services:
  koda:
    image: koda/koda:latest
    ports:
      - "3000:3000"
      - "15173-15272:15173-15272"  # Sandbox ports
    environment:
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - FAL_KEY=${FAL_KEY}
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock  # Docker-in-Docker
      - koda-data:/data                             # Persistent storage
    deploy:
      resources:
        limits:
          memory: 4G
          cpus: '4'

volumes:
  koda-data:
```

**Run:**
```bash
# Pull images
docker pull koda/koda:latest
docker pull koda/sandbox-theatre:latest
docker pull koda/sandbox-remotion:latest

# Start
docker-compose up -d

# Access at http://localhost:3000
```

### 4.2 Single Command (Docker Run)

```bash
docker run -d \
  --name koda \
  -p 3000:3000 \
  -p 15173-15272:15173-15272 \
  -e ANTHROPIC_API_KEY=sk-ant-... \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v koda-data:/data \
  koda/koda:latest
```

### 4.3 Cloud Deployment Options

#### Railway

```toml
# railway.toml
[build]
builder = "DOCKERFILE"

[deploy]
healthcheckPath = "/api/health"
healthcheckTimeout = 300
restartPolicyType = "ON_FAILURE"

[[services]]
name = "koda"
port = 3000
```

**Limitations:**
- No Docker-in-Docker on Railway
- Would need E2B provider for sandboxes

#### Render

```yaml
# render.yaml
services:
  - type: web
    name: koda
    env: docker
    dockerfilePath: ./Dockerfile
    envVars:
      - key: ANTHROPIC_API_KEY
        sync: false
    disk:
      name: koda-data
      mountPath: /data
      sizeGB: 10
```

**Limitations:**
- No Docker-in-Docker
- Need E2B or remote sandbox provider

#### Fly.io (Recommended for DinD)

```toml
# fly.toml
app = "koda"
primary_region = "sjc"

[build]
  image = "koda/koda:latest"

[env]
  PORT = "3000"

[http_service]
  internal_port = 3000
  force_https = true

[[services]]
  internal_port = 3000
  protocol = "tcp"

  [[services.ports]]
    port = 443
    handlers = ["tls", "http"]

[mounts]
  source = "koda_data"
  destination = "/data"

# Enable Docker-in-Docker
[experimental]
  enable_dind = true
```

```bash
fly launch --image koda/koda:latest
fly secrets set ANTHROPIC_API_KEY=sk-ant-...
fly deploy
```

#### Self-Hosted VPS (DigitalOcean, Hetzner, etc.)

```bash
# On Ubuntu 22.04+ VPS

# Install Docker
curl -fsSL https://get.docker.com | sh

# Create docker-compose.yml (see 4.1)

# Configure firewall
ufw allow 3000/tcp
ufw allow 15173:15272/tcp

# Start
docker-compose up -d

# Optional: Setup nginx reverse proxy with SSL
apt install nginx certbot python3-certbot-nginx
```

### 4.4 Kubernetes (Advanced)

```yaml
# koda-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: koda
spec:
  replicas: 1
  selector:
    matchLabels:
      app: koda
  template:
    metadata:
      labels:
        app: koda
    spec:
      containers:
        - name: koda
          image: koda/koda:latest
          ports:
            - containerPort: 3000
          env:
            - name: ANTHROPIC_API_KEY
              valueFrom:
                secretKeyRef:
                  name: koda-secrets
                  key: anthropic-api-key
          volumeMounts:
            - name: docker-sock
              mountPath: /var/run/docker.sock
            - name: data
              mountPath: /data
          resources:
            limits:
              memory: "4Gi"
              cpu: "4"
      volumes:
        - name: docker-sock
          hostPath:
            path: /var/run/docker.sock
        - name: data
          persistentVolumeClaim:
            claimName: koda-pvc
---
apiVersion: v1
kind: Service
metadata:
  name: koda
spec:
  type: LoadBalancer
  ports:
    - port: 80
      targetPort: 3000
  selector:
    app: koda
```

---

## 5. Build & Release Pipeline

### 5.1 Dockerfile (Main App)

```dockerfile
# Dockerfile
FROM node:20-slim AS base

# Install Docker CLI for DinD
RUN apt-get update && apt-get install -y \
    docker.io \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Dependencies
COPY package.json bun.lockb ./
RUN npm install -g bun && bun install --frozen-lockfile

# Build
COPY . .
RUN bun run build

# Production
FROM node:20-slim AS runner

RUN apt-get update && apt-get install -y \
    docker.io \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=base /app/.next/standalone ./
COPY --from=base /app/.next/static ./.next/static
COPY --from=base /app/public ./public
COPY --from=base /app/templates ./templates

# Pre-load sandbox images (optional, adds ~5GB)
# COPY sandbox-images/ /sandbox-images/

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000
EXPOSE 15173-15272

CMD ["node", "server.js"]
```

### 5.2 GitHub Actions Workflow

```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Login to Docker Hub
        uses: docker/login-action@v3
        with:
          username: ${{ secrets.DOCKERHUB_USERNAME }}
          password: ${{ secrets.DOCKERHUB_TOKEN }}

      - name: Extract version
        id: version
        run: echo "VERSION=${GITHUB_REF#refs/tags/v}" >> $GITHUB_OUTPUT

      - name: Build and push main image
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: |
            koda/koda:latest
            koda/koda:${{ steps.version.outputs.VERSION }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

      - name: Build and push Theatre sandbox
        uses: docker/build-push-action@v5
        with:
          context: ./templates/sandbox
          push: true
          tags: |
            koda/sandbox-theatre:latest
            koda/sandbox-theatre:${{ steps.version.outputs.VERSION }}

      - name: Build and push Remotion sandbox
        uses: docker/build-push-action@v5
        with:
          context: ./templates/remotion-sandbox
          push: true
          tags: |
            koda/sandbox-remotion:latest
            koda/sandbox-remotion:${{ steps.version.outputs.VERSION }}

  create-release:
    needs: build-and-push
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Create Release
        uses: softprops/action-gh-release@v1
        with:
          generate_release_notes: true
          files: |
            docker-compose.yml
            koda.config.example.yaml
```

### 5.3 Version Sync

```json
// package.json
{
  "name": "koda",
  "version": "1.0.0",
  "scripts": {
    "release": "npm version patch && git push --tags",
    "release:minor": "npm version minor && git push --tags",
    "release:major": "npm version major && git push --tags"
  }
}
```

---

## 6. Documentation Structure

```
docs/
├── README.md                    # Quick start
├── INSTALLATION.md              # Detailed installation
├── CONFIGURATION.md             # All config options
├── DEPLOYMENT/
│   ├── docker-compose.md
│   ├── fly-io.md
│   ├── kubernetes.md
│   └── vps.md
├── DEVELOPMENT.md               # Contributing guide
├── ARCHITECTURE.md              # System design
├── API.md                       # API reference
├── TROUBLESHOOTING.md           # Common issues
└── CHANGELOG.md                 # Release notes
```

### 6.1 Quick Start README

```markdown
# Koda - AI Animation Generator

Create stunning animations with AI using a visual node-based editor.

## Quick Start

```bash
# 1. Pull the images
docker pull koda/koda:latest
docker pull koda/sandbox-theatre:latest
docker pull koda/sandbox-remotion:latest

# 2. Run
docker run -d \
  --name koda \
  -p 3000:3000 \
  -p 15173-15272:15173-15272 \
  -e ANTHROPIC_API_KEY=your-key \
  -v /var/run/docker.sock:/var/run/docker.sock \
  koda/koda:latest

# 3. Open http://localhost:3000
```

## Features

- **Visual Node Editor** - Drag, drop, connect
- **AI Animation** - Describe what you want, AI builds it
- **Theatre.js** - 3D animations with React Three Fiber
- **Remotion** - 2D motion graphics
- **Live Preview** - See changes in real-time
- **Video Export** - 720p, 1080p, 4K rendering

## Requirements

- Docker 20.10+
- 4GB RAM minimum (8GB recommended)
- Anthropic API key (Claude)

## Documentation

- [Installation Guide](docs/INSTALLATION.md)
- [Configuration](docs/CONFIGURATION.md)
- [Deployment Options](docs/DEPLOYMENT/)
- [API Reference](docs/API.md)

## License

MIT
```

---

## 7. Security Considerations

### 7.1 Sandbox Isolation

```
┌─────────────────────────────────────────────────────────┐
│                    HOST SYSTEM                          │
│  ┌───────────────────────────────────────────────────┐  │
│  │              KODA CONTAINER                       │  │
│  │  ┌─────────────────────────────────────────────┐  │  │
│  │  │         SANDBOX CONTAINER                   │  │  │
│  │  │  • No network access to host                │  │  │
│  │  │  • Read-only /templates mount               │  │  │
│  │  │  • Memory/CPU limits enforced               │  │  │
│  │  │  • No privileged mode                       │  │  │
│  │  │  • Isolated bridge network                  │  │  │
│  │  └─────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### 7.2 Security Checklist

- [ ] Sandboxes run with `--network=koda-sandbox-net` (isolated)
- [ ] No `--privileged` flag on sandbox containers
- [ ] Memory limits enforced (`--memory=2g`)
- [ ] CPU limits enforced (`--cpus=2`)
- [ ] Path traversal validation on all file operations
- [ ] File size limits (100KB for code, 100MB for videos)
- [ ] Idle timeout cleanup (30 min default)
- [ ] Port range isolation (15173-15272)
- [ ] No secrets in sandbox environment
- [ ] Rate limiting on API endpoints (future)

### 7.3 API Key Security

```typescript
// Keys are NEVER sent to sandboxes
// Keys are NEVER logged
// Keys are validated at startup

// Recommended: Use secrets manager
docker run -e ANTHROPIC_API_KEY_FILE=/run/secrets/anthropic ...
```

---

## 8. Licensing

### 8.1 Recommended: MIT License

```
MIT License

Copyright (c) 2024 Koda Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### 8.2 Third-Party Licenses

Document all dependencies:

| Package | License | Notes |
|---------|---------|-------|
| Next.js | MIT | |
| React Flow | MIT | |
| Mastra | MIT | |
| Theatre.js | Apache 2.0 | |
| Remotion | Business Source License | Free for personal/small business |
| Three.js | MIT | |
| FFmpeg | LGPL/GPL | Dynamic linking OK |

**Note:** Remotion has a [BSL license](https://www.remotion.dev/license) - free for companies < $1M revenue, otherwise requires license.

---

## 9. Community & Contributions

### 9.1 Repository Structure

```
koda/
├── .github/
│   ├── ISSUE_TEMPLATE/
│   ├── PULL_REQUEST_TEMPLATE.md
│   ├── CONTRIBUTING.md
│   ├── CODE_OF_CONDUCT.md
│   └── workflows/
├── docs/
├── templates/
│   ├── sandbox/           # Theatre.js
│   └── remotion-sandbox/  # Remotion
├── src/
├── docker-compose.yml
├── Dockerfile
├── LICENSE
└── README.md
```

### 9.2 Issue Templates

```markdown
<!-- .github/ISSUE_TEMPLATE/bug_report.md -->
---
name: Bug Report
about: Report a bug
labels: bug
---

## Environment
- Koda version:
- Docker version:
- OS:
- Browser:

## Bug Description

## Steps to Reproduce

## Expected Behavior

## Actual Behavior

## Logs
```

### 9.3 Contributing Guide

```markdown
# Contributing to Koda

## Development Setup

1. Clone the repo
2. Copy `.env.example` to `.env`
3. Run `bun install`
4. Run `bun dev`

## Making Changes

1. Fork the repo
2. Create a feature branch
3. Make changes
4. Run tests: `bun test`
5. Submit PR

## Code Style

- TypeScript strict mode
- Prettier + ESLint
- Conventional commits

## Areas to Contribute

- [ ] E2B sandbox provider
- [ ] Additional animation frameworks
- [ ] UI improvements
- [ ] Documentation
- [ ] Translations
```

---

## 10. E2B Provider Implementation

### 10.1 Provider Strategy

```
┌─────────────────────────────────────────────────────────────────┐
│                     DEPLOYMENT OPTIONS                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   SELF-HOSTED                      KODA CLOUD (Hosted)          │
│   ─────────────                    ────────────────────         │
│   Provider: Docker                 Provider: E2B                │
│   Cost: Free                       Cost: Usage-based            │
│   Setup: docker-compose            Setup: None (managed)        │
│   Scaling: Manual                  Scaling: Auto                │
│   Cold start: 3-5s                 Cold start: 1-2s             │
│                                                                 │
│   Best for:                        Best for:                    │
│   • Local development              • Production SaaS            │
│   • VPS deployment                 • Serverless (Vercel, etc)   │
│   • Air-gapped environments        • High concurrency           │
│   • Full control                   • No Docker management       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 10.2 E2B Implementation

**File: `src/lib/sandbox/e2b-provider.ts`**

```typescript
import { Sandbox } from '@e2b/code-interpreter';
import type {
  SandboxProvider,
  SandboxInstance,
  SandboxFile,
  SandboxTemplate,
  CommandResult,
} from './types';

// E2B template IDs (created via e2b CLI)
const E2B_TEMPLATES: Record<SandboxTemplate, string> = {
  theatre: 'koda-theatre-v1',
  remotion: 'koda-remotion-v1',
};

export class E2BProvider implements SandboxProvider {
  private sandboxes: Map<string, Sandbox> = new Map();

  async create(projectId: string, template: SandboxTemplate = 'theatre'): Promise<SandboxInstance> {
    const sandbox = await Sandbox.create({
      template: E2B_TEMPLATES[template],
      metadata: { projectId },
      timeoutMs: 30 * 60 * 1000, // 30 min
    });

    this.sandboxes.set(sandbox.sandboxId, sandbox);

    // Start Vite dev server
    await sandbox.commands.run('cd /app && bun run dev &', { background: true });

    return {
      id: sandbox.sandboxId,
      projectId,
      status: 'ready',
      createdAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
      template,
      // E2B provides a public URL instead of port
      previewUrl: `https://${sandbox.getHost(5173)}`,
    };
  }

  async destroy(sandboxId: string): Promise<void> {
    const sandbox = this.sandboxes.get(sandboxId);
    if (sandbox) {
      await sandbox.close();
      this.sandboxes.delete(sandboxId);
    }
  }

  async writeFile(sandboxId: string, path: string, content: string): Promise<void> {
    const sandbox = this.sandboxes.get(sandboxId);
    if (!sandbox) throw new Error(`Sandbox ${sandboxId} not found`);

    const fullPath = path.startsWith('/app/') ? path : `/app/${path}`;
    await sandbox.files.write(fullPath, content);
  }

  async readFile(sandboxId: string, path: string): Promise<string> {
    const sandbox = this.sandboxes.get(sandboxId);
    if (!sandbox) throw new Error(`Sandbox ${sandboxId} not found`);

    const fullPath = path.startsWith('/app/') ? path : `/app/${path}`;
    return await sandbox.files.read(fullPath);
  }

  async listFiles(sandboxId: string, path: string, recursive = false): Promise<SandboxFile[]> {
    const sandbox = this.sandboxes.get(sandboxId);
    if (!sandbox) throw new Error(`Sandbox ${sandboxId} not found`);

    const fullPath = path.startsWith('/app/') ? path : `/app/${path}`;
    const files = await sandbox.files.list(fullPath);

    return files.map(f => ({
      path: f.path,
      type: f.isDir ? 'directory' : 'file',
      size: f.size,
    }));
  }

  async runCommand(
    sandboxId: string,
    command: string,
    options?: { background?: boolean; timeout?: number }
  ): Promise<CommandResult> {
    const sandbox = this.sandboxes.get(sandboxId);
    if (!sandbox) throw new Error(`Sandbox ${sandboxId} not found`);

    const result = await sandbox.commands.run(command, {
      timeoutMs: options?.timeout || 5 * 60 * 1000,
      background: options?.background,
    });

    return {
      success: result.exitCode === 0,
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
    };
  }

  async getStatus(sandboxId: string): Promise<SandboxInstance | null> {
    const sandbox = this.sandboxes.get(sandboxId);
    if (!sandbox) return null;

    return {
      id: sandboxId,
      projectId: sandbox.metadata?.projectId || '',
      status: 'ready',
      createdAt: '',
      lastActivityAt: new Date().toISOString(),
    };
  }
}
```

### 10.3 E2B Template Setup

Create E2B templates from existing Dockerfiles:

```bash
# Install E2B CLI
npm install -g @e2b/cli

# Login
e2b auth login

# Create Theatre.js template
cd templates/sandbox
e2b template build --name koda-theatre-v1

# Create Remotion template
cd ../remotion-sandbox
e2b template build --name koda-remotion-v1
```

**E2B Template Config (`e2b.toml`):**

```toml
# templates/sandbox/e2b.toml
template_id = "koda-theatre-v1"
dockerfile = "Dockerfile"
template_name = "Koda Theatre.js Sandbox"

[resources]
cpu_count = 2
memory_mb = 2048
```

### 10.4 Provider Selection

**Config-based selection:**

```typescript
// src/lib/sandbox/index.ts
import { DockerProvider } from './docker-provider';
import { E2BProvider } from './e2b-provider';
import type { SandboxProvider } from './types';

export function createSandboxProvider(): SandboxProvider {
  const provider = process.env.SANDBOX_PROVIDER || 'docker';

  switch (provider) {
    case 'e2b':
      if (!process.env.E2B_API_KEY) {
        throw new Error('E2B_API_KEY required for E2B provider');
      }
      return new E2BProvider();

    case 'docker':
    default:
      return new DockerProvider();
  }
}

// Singleton instance
export const sandboxProvider = createSandboxProvider();
```

**Environment variables:**

```bash
# For self-hosted (Docker)
SANDBOX_PROVIDER=docker

# For Koda Cloud (E2B)
SANDBOX_PROVIDER=e2b
E2B_API_KEY=e2b_...
```

### 10.5 E2B vs Docker Feature Comparison

| Feature | Docker | E2B |
|---------|--------|-----|
| Preview URL | `localhost:PORT` via proxy | Direct `*.e2b.dev` URL |
| File access | `docker exec` | SDK `files.read/write` |
| Commands | `docker exec` | SDK `commands.run` |
| Screenshots | Puppeteer in container | Puppeteer in container |
| Video render | FFmpeg in container | FFmpeg in container |
| Persistence | Local volume | E2B managed |
| Timeout | Custom (30 min default) | E2B managed (max 1 hour) |
| Cost | Free (your compute) | ~$0.10/hour |

### 10.6 E2B Implementation Checklist

- [ ] Create `e2b-provider.ts` (~150 lines)
- [ ] Create E2B templates from Dockerfiles
- [ ] Update `sandbox-tools.ts` to use provider abstraction
- [ ] Handle E2B preview URLs (no proxy needed)
- [ ] Add E2B API key to environment config
- [ ] Test Theatre.js workflow on E2B
- [ ] Test Remotion workflow on E2B
- [ ] Update documentation

**Estimated effort: 2-3 days**

---

## 11. Hosted vs Self-Hosted Feature Matrix

| Feature | Self-Hosted (Docker) | Koda Cloud (E2B) |
|---------|---------------------|------------------|
| Animation generation | ✅ | ✅ |
| Theatre.js (3D) | ✅ | ✅ |
| Remotion (2D) | ✅ | ✅ |
| Live preview | ✅ via proxy | ✅ direct URL |
| Video export | ✅ | ✅ |
| Concurrent sandboxes | Limited by hardware | Auto-scaling |
| Cold start | 3-5s | 1-2s |
| Setup required | Docker + compose | None |
| Updates | Manual pull | Automatic |
| Cost | Your compute | Pay-per-use |
| Support | Community | Priority |
| SLA | None | 99.9% |
| Image generation | ✅ (bring your FAL key) | ✅ (included) |
| Video generation | ✅ (bring your FAL key) | ✅ (included) |
| API access | ✅ | ✅ |
| White-label | ✅ | Enterprise only |

---

## 12. Roadmap for Open Source Release

### Phase 1: Preparation (Week 1-2)

- [ ] Clean up codebase (remove internal references)
- [ ] Add comprehensive comments
- [ ] Write all documentation
- [ ] Create example animations
- [ ] Set up Docker Hub organization
- [ ] Create GitHub organization
- [ ] Set up CI/CD pipeline

### Phase 2: Alpha Release (Week 3)

- [ ] Push to public GitHub repo
- [ ] Publish Docker images
- [ ] Announce on Twitter/X
- [ ] Create Discord server
- [ ] Gather initial feedback

### Phase 3: Beta Release (Week 4-6)

- [ ] Address alpha feedback
- [ ] Improve documentation
- [ ] Add more examples
- [ ] Performance optimizations
- [ ] Security audit

### Phase 4: Stable Release (Week 7-8)

- [ ] v1.0.0 release
- [ ] ProductHunt launch
- [ ] Hacker News post
- [ ] Blog post announcement
- [ ] Video tutorial

---

## 13. Metrics & Telemetry (Optional)

If users opt-in, collect anonymous usage:

```typescript
// Anonymous, opt-in telemetry
interface TelemetryEvent {
  event: 'sandbox_created' | 'animation_generated' | 'video_rendered';
  framework: 'theatre' | 'remotion';
  duration_ms: number;
  success: boolean;
  // NO user data, NO prompts, NO API keys
}
```

---

## Summary

This spec outlines a clear path to open-source Koda:

1. **Single Docker image** with everything included
2. **Separate sandbox images** for Theatre.js and Remotion
3. **Simple configuration** via environment variables or YAML
4. **Multiple deployment options** from local to cloud
5. **MIT license** for maximum adoption
6. **Comprehensive documentation** for all skill levels
7. **Community-friendly** contribution guidelines

The goal is to make it as easy as possible for users to run their own AI animation generator with a single `docker run` command.
