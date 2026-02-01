# Koda Storage Architecture Plan

## Overview

Support multiple storage backends for open-source flexibility:

| Backend | Type | Best For | Sync |
|---------|------|----------|------|
| **localStorage** | Browser | Quick demo, single device | ❌ |
| **SQLite (local)** | File | Self-hosters, offline-first | ❌ |
| **Turso** | libSQL Cloud | Free cloud sync, serverless | ✅ |
| **PostgreSQL** | Server | Enterprise, existing infra | ✅ |

## Design Decisions

### 1. JSON Blob Storage (Chosen)

Store nodes and edges as JSON blobs rather than normalized tables:

```sql
CREATE TABLE canvases (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  nodes TEXT,           -- JSON: '[{id, type, position, data}, ...]'
  edges TEXT,           -- JSON: '[{id, source, target}, ...]'
  thumbnail TEXT,
  created_at INTEGER,
  updated_at INTEGER
);
```

**Rationale**:
- Zero schema changes when node types evolve
- Single query loads entire canvas (fast)
- Direct compatibility with existing localStorage format
- Simpler migration path

### 2. Environment-Based Configuration

Self-hosters configure storage via environment variables:

```bash
STORAGE_BACKEND=sqlite
SQLITE_PATH=/path/to/koda.db
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Application                              │
│                              │                                   │
│                    ┌─────────┴─────────┐                        │
│                    │  StorageProvider  │  ← Existing interface  │
│                    │    (abstract)     │                        │
│                    └─────────┬─────────┘                        │
│                              │                                   │
│         ┌────────────────────┼────────────────────┐             │
│         ▼                    ▼                    ▼             │
│  ┌─────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │ localStorage│    │  Drizzle ORM │    │  Drizzle ORM │       │
│  │  Provider   │    │   (SQLite)   │    │  (Postgres)  │       │
│  └─────────────┘    └──────┬───────┘    └──────┬───────┘       │
│                            │                    │               │
│                   ┌────────┴────────┐          │               │
│                   ▼                 ▼          ▼               │
│              ┌────────┐       ┌─────────┐  ┌─────────┐         │
│              │ Local  │       │  Turso  │  │Postgres │         │
│              │ SQLite │       │  Cloud  │  │ Server  │         │
│              │ (file) │       │         │  │         │         │
│              └────────┘       └─────────┘  └─────────┘         │
└─────────────────────────────────────────────────────────────────┘

Asset Storage (blobs):
┌─────────────────────────────────────────────────────────────────┐
│  Browser: IndexedDB  │  Cloud: S3/R2/Supabase Storage          │
└─────────────────────────────────────────────────────────────────┘
```

---

## New Dependencies

```json
{
  "dependencies": {
    "drizzle-orm": "^0.38.0",
    "@libsql/client": "^0.14.0",
    "dexie": "^4.0.0"
  },
  "devDependencies": {
    "drizzle-kit": "^0.30.0"
  },
  "optionalDependencies": {
    "pg": "^8.13.0"
  }
}
```

**Note**: `pg` is optional - only needed if user chooses PostgreSQL.

---

## Database Schema (JSON Blob Approach)

### SQLite Tables

```sql
-- Canvases (projects) - nodes/edges stored as JSON
CREATE TABLE canvases (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  nodes TEXT,              -- JSON blob: '[{id, type, position, data}, ...]'
  edges TEXT,              -- JSON blob: '[{id, source, target}, ...]'
  thumbnail TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Index for listing by updated time
CREATE INDEX idx_canvases_updated ON canvases(updated_at DESC);
```

### Drizzle Schema

```typescript
// src/lib/db/schema.ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const canvases = sqliteTable('canvases', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  nodes: text('nodes'),      // JSON string
  edges: text('edges'),      // JSON string
  thumbnail: text('thumbnail'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});
```

### Future Tables (Hosted Version)

These will be added later for the hosted/paid version:

```sql
-- Users (hosted only)
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  created_at INTEGER NOT NULL
);

-- Add user_id to canvases for multi-user
ALTER TABLE canvases ADD COLUMN user_id TEXT REFERENCES users(id);
```

---

## File Structure

```
src/lib/
├── storage/
│   ├── types.ts                    # StorageProvider interface (existing)
│   ├── index.ts                    # Provider factory (existing, update)
│   ├── local-storage-provider.ts   # Browser localStorage (existing)
│   └── database-provider.ts        # NEW: Drizzle-based provider
│
├── db/
│   ├── index.ts                    # Database client factory
│   ├── migrate.ts                  # Migration runner
│   ├── schema/
│   │   ├── index.ts                # Export all schemas
│   │   ├── canvases.ts             # Canvas tables
│   │   ├── users.ts                # User tables (hosted)
│   │   └── assets.ts               # Asset tables
│   ├── adapters/
│   │   ├── sqlite.ts               # libSQL/SQLite adapter
│   │   └── postgres.ts             # PostgreSQL adapter
│   └── repositories/
│       ├── canvas.ts               # Canvas CRUD operations
│       ├── node.ts                 # Node operations
│       ├── edge.ts                 # Edge operations
│       └── asset.ts                # Asset operations
│
├── assets/
│   ├── index.ts                    # Asset storage factory
│   ├── indexeddb.ts                # Browser blob storage
│   └── cloud.ts                    # S3/R2/Supabase storage
│
└── config/
    └── storage.ts                  # Storage configuration
```

---

## Configuration

### Environment Variables

```bash
# .env.example

# ============================================
# STORAGE CONFIGURATION
# ============================================

# Storage backend: 'localStorage' | 'sqlite'
# - localStorage: Browser storage (default, no setup)
# - sqlite: SQLite database (local file or Turso cloud)
NEXT_PUBLIC_STORAGE_BACKEND=localStorage

# ============================================
# SQLite Configuration (when STORAGE_BACKEND=sqlite)
# ============================================

# Local SQLite file path
# Examples:
#   ./data/koda.db            - Relative to project root
#   /home/user/koda/koda.db   - Absolute path
#   :memory:                  - In-memory (lost on restart)
SQLITE_PATH=./data/koda.db

# Turso Cloud (optional, overrides SQLITE_PATH)
# Get these from https://turso.tech
TURSO_DATABASE_URL=
TURSO_AUTH_TOKEN=
```

---

## Implementation Phases

### Phase 1: SQLite Foundation ✅ IN PROGRESS
- [x] Add Drizzle ORM + libSQL dependencies
- [x] Create database schema (JSON blob style)
- [x] Create `SQLiteStorageProvider` implementing existing interface
- [x] Add environment-based configuration
- [x] Update provider factory to support sqlite
- [x] Add migration script

**Files:**
- `package.json` - Add dependencies
- `src/lib/db/schema.ts` - Database schema
- `src/lib/db/index.ts` - Client factory
- `src/lib/db/migrate.ts` - Migration script
- `src/lib/storage/sqlite-provider.ts` - SQLite provider
- `src/lib/storage/index.ts` - Update factory
- `.env.example` - Document variables

### Phase 2: Testing & Polish
- [ ] Test localStorage → SQLite migration
- [ ] Add Drizzle Studio for debugging
- [ ] Self-hosting documentation
- [ ] Docker support

### Phase 3: PostgreSQL (Future)
- [ ] Add PostgreSQL adapter
- [ ] Test with Supabase/Neon
- [ ] Docker Compose for local Postgres

### Phase 4: Hosted Features (Future)
- [ ] User authentication
- [ ] Multi-user canvases
- [ ] Cloud asset storage

---

## SQLite Provider Implementation

```typescript
// src/lib/storage/sqlite-provider.ts
import { eq, desc } from 'drizzle-orm';
import type { StorageProvider, StoredCanvas, CanvasMetadata } from './types';
import { getDatabase } from '../db';
import { canvases } from '../db/schema';

export class SQLiteStorageProvider implements StorageProvider {
  async listCanvases(): Promise<CanvasMetadata[]> {
    const db = getDatabase();
    const results = await db
      .select()
      .from(canvases)
      .orderBy(desc(canvases.updatedAt));

    return results.map(c => {
      const nodes = c.nodes ? JSON.parse(c.nodes) : [];
      return {
        id: c.id,
        name: c.name,
        thumbnail: c.thumbnail || undefined,
        createdAt: c.createdAt.getTime(),
        updatedAt: c.updatedAt.getTime(),
        nodeCount: nodes.length,
      };
    });
  }

  async getCanvas(id: string): Promise<StoredCanvas | null> {
    const db = getDatabase();
    const [canvas] = await db
      .select()
      .from(canvases)
      .where(eq(canvases.id, id));

    if (!canvas) return null;

    return {
      id: canvas.id,
      name: canvas.name,
      thumbnail: canvas.thumbnail || undefined,
      createdAt: canvas.createdAt.getTime(),
      updatedAt: canvas.updatedAt.getTime(),
      nodes: canvas.nodes ? JSON.parse(canvas.nodes) : [],
      edges: canvas.edges ? JSON.parse(canvas.edges) : [],
    };
  }

  async saveCanvas(canvas: StoredCanvas): Promise<void> {
    const db = getDatabase();
    const now = new Date();

    await db
      .insert(canvases)
      .values({
        id: canvas.id,
        name: canvas.name,
        nodes: JSON.stringify(canvas.nodes),
        edges: JSON.stringify(canvas.edges),
        thumbnail: canvas.thumbnail,
        createdAt: new Date(canvas.createdAt),
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: canvases.id,
        set: {
          name: canvas.name,
          nodes: JSON.stringify(canvas.nodes),
          edges: JSON.stringify(canvas.edges),
          thumbnail: canvas.thumbnail,
          updatedAt: now,
        },
      });
  }

  async deleteCanvas(id: string): Promise<void> {
    const db = getDatabase();
    await db.delete(canvases).where(eq(canvases.id, id));
  }

  async canvasExists(id: string): Promise<boolean> {
    const db = getDatabase();
    const [result] = await db
      .select({ id: canvases.id })
      .from(canvases)
      .where(eq(canvases.id, id));
    return !!result;
  }
}
```

---

## Self-Hosting Documentation

```markdown
# Self-Hosting Koda

## Quick Start (No Database)

Just run Koda - it uses browser localStorage by default.

\`\`\`bash
git clone https://github.com/your/koda.git
cd koda
npm install
npm run dev
\`\`\`

## Option 1: Local SQLite Database

Better for multiple projects and data persistence.

\`\`\`bash
# .env.local
NEXT_PUBLIC_STORAGE_BACKEND=sqlite
SQLITE_PATH=./data/koda.db
\`\`\`

\`\`\`bash
npm run db:migrate
npm run dev
\`\`\`

## Option 2: Turso (Free Cloud SQLite)

Sync across devices with Turso's free tier.

1. Create account at https://turso.tech
2. Create a database
3. Get connection URL and token

\`\`\`bash
# .env.local
NEXT_PUBLIC_STORAGE_BACKEND=sqlite
TURSO_DATABASE_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=your-token
\`\`\`

## Docker Deployment

\`\`\`yaml
# docker-compose.yml
version: '3.8'
services:
  koda:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_STORAGE_BACKEND=sqlite
      - SQLITE_PATH=/data/koda.db
    volumes:
      - ./data:/data
\`\`\`

## Comparison

| Backend | Setup | Persistence | Sync | Cost |
|---------|-------|-------------|------|------|
| localStorage | None | Browser only | ❌ | Free |
| SQLite (local) | 1 env var | File | ❌ | Free |
| Turso | Account | Cloud | ✅ | Free tier |
```

---

## Asset Storage

Generated images, videos, and audio are stored separately from canvas data.

### Asset Storage Options

| Backend | Best For | Cost | Free Tier |
|---------|----------|------|-----------|
| **local** | Self-hosting | Free | ∞ |
| **r2** | Cloud (recommended) | $0.015/GB | 10GB/month |
| **s3** | Enterprise/AWS | $0.023/GB + egress | 5GB (12mo) |

### Why R2 over S3?

- **Zero egress fees** - S3 charges $0.09/GB when users download images
- **Permanent free tier** - 10GB free forever (S3 expires after 12 months)
- **Same API** - S3-compatible, same code works for both

### Configuration

```bash
# Local storage (default for self-hosting)
ASSET_STORAGE=local
ASSET_LOCAL_PATH=./data/generations

# Cloudflare R2 (recommended for cloud)
ASSET_STORAGE=r2
R2_ACCOUNT_ID=your-account-id
R2_ACCESS_KEY_ID=your-key
R2_SECRET_ACCESS_KEY=your-secret
R2_BUCKET_NAME=koda-assets
R2_PUBLIC_URL=https://assets.yourdomain.com

# AWS S3 (enterprise)
ASSET_STORAGE=s3
S3_ACCESS_KEY_ID=your-key
S3_SECRET_ACCESS_KEY=your-secret
S3_BUCKET_NAME=koda-assets
S3_REGION=us-east-1
```

### How It Works

1. User generates an image/video/audio
2. Fal.ai returns a temporary URL (expires in 24-48h)
3. If asset storage is configured:
   - Download the file from fal.ai
   - Save to local filesystem or cloud bucket
   - Return the permanent local/cloud URL
4. Node stores the permanent URL

### File Structure (Local)

```
./data/
├── koda.db                    # SQLite database
└── generations/
    ├── manifest.json          # Asset metadata
    ├── img_abc123.png         # Generated images
    ├── vid_def456.mp4         # Generated videos
    └── aud_ghi789.mp3         # Generated audio
```
