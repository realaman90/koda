# Koda Storage Architecture Plan

## Overview

Support multiple storage backends for open-source flexibility:

| Backend | Type | Best For | Sync |
|---------|------|----------|------|
| **localStorage** | Browser | Quick demo, single device | ❌ |
| **SQLite (local)** | File | Self-hosters, offline-first | ❌ |
| **Turso** | libSQL Cloud | Free cloud sync, serverless | ✅ |
| **PostgreSQL (local)** | Server | Enterprise, existing infra | ❌ |
| **PostgreSQL (cloud)** | Supabase/Neon | Hosted version, teams | ✅ |

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

## Database Schema

### Tables

```sql
-- Users (for hosted version, optional for self-hosted)
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Canvases (projects)
CREATE TABLE canvases (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  thumbnail TEXT,
  is_template BOOLEAN DEFAULT FALSE,
  is_public BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Canvas Nodes (stored separately for better querying)
CREATE TABLE canvas_nodes (
  id TEXT PRIMARY KEY,
  canvas_id TEXT NOT NULL REFERENCES canvases(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  position_x REAL NOT NULL,
  position_y REAL NOT NULL,
  width REAL,
  height REAL,
  data JSON NOT NULL,
  z_index INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Canvas Edges (connections)
CREATE TABLE canvas_edges (
  id TEXT PRIMARY KEY,
  canvas_id TEXT NOT NULL REFERENCES canvases(id) ON DELETE CASCADE,
  source_node_id TEXT NOT NULL,
  source_handle TEXT,
  target_node_id TEXT NOT NULL,
  target_handle TEXT,
  type TEXT DEFAULT 'default'
);

-- Assets (generated images/videos metadata)
CREATE TABLE assets (
  id TEXT PRIMARY KEY,
  canvas_id TEXT REFERENCES canvases(id) ON DELETE CASCADE,
  node_id TEXT,
  type TEXT NOT NULL,           -- 'image' | 'video' | 'audio'
  filename TEXT,
  mime_type TEXT,
  size_bytes INTEGER,
  url TEXT,                      -- Remote URL (S3, fal.ai CDN, etc.)
  local_blob_key TEXT,           -- IndexedDB key for local storage
  metadata JSON,                 -- Model used, prompt, etc.
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Generation History (for analytics & retry)
CREATE TABLE generations (
  id TEXT PRIMARY KEY,
  canvas_id TEXT REFERENCES canvases(id) ON DELETE CASCADE,
  node_id TEXT,
  user_id TEXT REFERENCES users(id),
  model TEXT NOT NULL,
  prompt TEXT,
  parameters JSON,
  status TEXT DEFAULT 'pending', -- pending, processing, completed, failed
  result_asset_id TEXT REFERENCES assets(id),
  error_message TEXT,
  duration_ms INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User Settings/Preferences
CREATE TABLE user_settings (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  theme TEXT DEFAULT 'dark',
  default_model TEXT,
  api_keys_encrypted JSON,       -- Encrypted user API keys
  preferences JSON,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_canvases_user ON canvases(user_id);
CREATE INDEX idx_canvases_updated ON canvases(updated_at DESC);
CREATE INDEX idx_nodes_canvas ON canvas_nodes(canvas_id);
CREATE INDEX idx_edges_canvas ON canvas_edges(canvas_id);
CREATE INDEX idx_assets_canvas ON assets(canvas_id);
CREATE INDEX idx_generations_canvas ON generations(canvas_id);
```

### Drizzle Schema

```typescript
// src/lib/db/schema/canvases.ts
import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const canvases = sqliteTable('canvases', {
  id: text('id').primaryKey(),
  userId: text('user_id'),
  name: text('name').notNull(),
  description: text('description'),
  thumbnail: text('thumbnail'),
  isTemplate: integer('is_template', { mode: 'boolean' }).default(false),
  isPublic: integer('is_public', { mode: 'boolean' }).default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const canvasNodes = sqliteTable('canvas_nodes', {
  id: text('id').primaryKey(),
  canvasId: text('canvas_id').notNull().references(() => canvases.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  positionX: real('position_x').notNull(),
  positionY: real('position_y').notNull(),
  width: real('width'),
  height: real('height'),
  data: text('data', { mode: 'json' }).notNull(),
  zIndex: integer('z_index').default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const canvasEdges = sqliteTable('canvas_edges', {
  id: text('id').primaryKey(),
  canvasId: text('canvas_id').notNull().references(() => canvases.id, { onDelete: 'cascade' }),
  sourceNodeId: text('source_node_id').notNull(),
  sourceHandle: text('source_handle'),
  targetNodeId: text('target_node_id').notNull(),
  targetHandle: text('target_handle'),
  type: text('type').default('default'),
});

export const assets = sqliteTable('assets', {
  id: text('id').primaryKey(),
  canvasId: text('canvas_id').references(() => canvases.id, { onDelete: 'cascade' }),
  nodeId: text('node_id'),
  type: text('type').notNull(),
  filename: text('filename'),
  mimeType: text('mime_type'),
  sizeBytes: integer('size_bytes'),
  url: text('url'),
  localBlobKey: text('local_blob_key'),
  metadata: text('metadata', { mode: 'json' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});
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

# Storage backend: 'localStorage' | 'sqlite' | 'postgres'
NEXT_PUBLIC_STORAGE_BACKEND=localStorage

# ============================================
# SQLite / libSQL Configuration
# ============================================

# Local SQLite file (for sqlite backend)
# Examples:
#   file:./data/koda.db       - Local file in project
#   file:/path/to/koda.db     - Absolute path
#   :memory:                  - In-memory (lost on restart)
SQLITE_URL=file:./data/koda.db

# Turso Cloud (optional, for cloud sync)
# Get these from https://turso.tech
TURSO_DATABASE_URL=
TURSO_AUTH_TOKEN=

# ============================================
# PostgreSQL Configuration
# ============================================

# PostgreSQL connection string (for postgres backend)
# Examples:
#   postgres://user:pass@localhost:5432/koda       - Local
#   postgres://user:pass@db.supabase.co:5432/koda  - Supabase
#   postgres://user:pass@ep-xxx.neon.tech/koda     - Neon
DATABASE_URL=

# ============================================
# Asset Storage (for generated images/videos)
# ============================================

# Asset storage: 'local' | 's3' | 'r2' | 'supabase'
ASSET_STORAGE=local

# S3-compatible storage (S3, R2, Supabase Storage)
S3_BUCKET=
S3_REGION=
S3_ACCESS_KEY=
S3_SECRET_KEY=
S3_ENDPOINT=              # For R2: https://xxx.r2.cloudflarestorage.com

# ============================================
# Feature Flags
# ============================================

# Enable hosted-only features (auth, teams, etc.)
HOSTED_MODE=false
```

### Configuration Module

```typescript
// src/lib/config/storage.ts
export type StorageBackend = 'localStorage' | 'sqlite' | 'postgres';
export type AssetStorage = 'local' | 's3' | 'r2' | 'supabase';

export interface StorageConfig {
  backend: StorageBackend;
  sqlite?: {
    url: string;
    authToken?: string;
  };
  postgres?: {
    url: string;
  };
  assets: {
    storage: AssetStorage;
    s3?: {
      bucket: string;
      region: string;
      accessKey: string;
      secretKey: string;
      endpoint?: string;
    };
  };
  hostedMode: boolean;
}

export function getStorageConfig(): StorageConfig {
  const backend = (process.env.NEXT_PUBLIC_STORAGE_BACKEND || 'localStorage') as StorageBackend;
  
  return {
    backend,
    sqlite: backend === 'sqlite' ? {
      url: process.env.TURSO_DATABASE_URL || process.env.SQLITE_URL || 'file:./data/koda.db',
      authToken: process.env.TURSO_AUTH_TOKEN,
    } : undefined,
    postgres: backend === 'postgres' ? {
      url: process.env.DATABASE_URL || '',
    } : undefined,
    assets: {
      storage: (process.env.ASSET_STORAGE || 'local') as AssetStorage,
      s3: process.env.S3_BUCKET ? {
        bucket: process.env.S3_BUCKET,
        region: process.env.S3_REGION || 'auto',
        accessKey: process.env.S3_ACCESS_KEY || '',
        secretKey: process.env.S3_SECRET_KEY || '',
        endpoint: process.env.S3_ENDPOINT,
      } : undefined,
    },
    hostedMode: process.env.HOSTED_MODE === 'true',
  };
}
```

---

## Implementation Phases

### Phase 1: Foundation (Week 1)
- [ ] Add Drizzle ORM + dependencies
- [ ] Create database schema (SQLite version)
- [ ] Create `DatabaseStorageProvider` implementing existing interface
- [ ] Add configuration module
- [ ] Update provider factory to support sqlite

**Files to create/modify:**
- `package.json` - Add dependencies
- `src/lib/db/schema/*.ts` - Database schema
- `src/lib/db/index.ts` - Client factory
- `src/lib/storage/database-provider.ts` - New provider
- `src/lib/storage/index.ts` - Update factory
- `src/lib/config/storage.ts` - Configuration

### Phase 2: Local SQLite (Week 2)
- [ ] Implement SQLite adapter with libSQL
- [ ] Add migration system
- [ ] Add data migration from localStorage
- [ ] Test offline functionality
- [ ] Add database scripts to package.json

**New scripts:**
```json
{
  "scripts": {
    "db:generate": "drizzle-kit generate",
    "db:migrate": "tsx src/lib/db/migrate.ts",
    "db:studio": "drizzle-kit studio"
  }
}
```

### Phase 3: PostgreSQL Support (Week 3)
- [ ] Create PostgreSQL schema variant
- [ ] Implement Postgres adapter
- [ ] Test with local PostgreSQL
- [ ] Test with Supabase
- [ ] Add Docker Compose for local Postgres

### Phase 4: Asset Storage (Week 4)
- [ ] Implement IndexedDB for local blob storage
- [ ] Implement S3-compatible storage module
- [ ] Update nodes to use asset storage
- [ ] Add asset cleanup on canvas delete

### Phase 5: Migration & Polish (Week 5)
- [ ] localStorage → Database migration flow
- [ ] Error handling and retry logic
- [ ] Loading states during migration
- [ ] Self-hosting documentation
- [ ] Docker images

---

## Database Provider Implementation

```typescript
// src/lib/storage/database-provider.ts
import { eq } from 'drizzle-orm';
import type { StorageProvider, StoredCanvas, CanvasMetadata } from './types';
import { canvasToMetadata } from './types';
import { getDatabase } from '../db';
import { canvases, canvasNodes, canvasEdges } from '../db/schema';

export class DatabaseStorageProvider implements StorageProvider {
  private db = getDatabase();

  async listCanvases(): Promise<CanvasMetadata[]> {
    const results = await this.db
      .select()
      .from(canvases)
      .orderBy(canvases.updatedAt);

    return results.map(c => ({
      id: c.id,
      name: c.name,
      thumbnail: c.thumbnail || undefined,
      createdAt: c.createdAt?.getTime() || Date.now(),
      updatedAt: c.updatedAt?.getTime() || Date.now(),
      nodeCount: 0, // TODO: Add count query
    }));
  }

  async getCanvas(id: string): Promise<StoredCanvas | null> {
    const [canvas] = await this.db
      .select()
      .from(canvases)
      .where(eq(canvases.id, id));

    if (!canvas) return null;

    const nodes = await this.db
      .select()
      .from(canvasNodes)
      .where(eq(canvasNodes.canvasId, id));

    const edges = await this.db
      .select()
      .from(canvasEdges)
      .where(eq(canvasEdges.canvasId, id));

    return {
      id: canvas.id,
      name: canvas.name,
      thumbnail: canvas.thumbnail || undefined,
      createdAt: canvas.createdAt?.getTime() || Date.now(),
      updatedAt: canvas.updatedAt?.getTime() || Date.now(),
      nodes: nodes.map(n => ({
        id: n.id,
        type: n.type,
        position: { x: n.positionX, y: n.positionY },
        data: n.data as any,
        width: n.width || undefined,
        height: n.height || undefined,
      })),
      edges: edges.map(e => ({
        id: e.id,
        source: e.sourceNodeId,
        sourceHandle: e.sourceHandle || undefined,
        target: e.targetNodeId,
        targetHandle: e.targetHandle || undefined,
        type: e.type || 'default',
      })),
    };
  }

  async saveCanvas(canvas: StoredCanvas): Promise<void> {
    const now = new Date();

    // Upsert canvas
    await this.db
      .insert(canvases)
      .values({
        id: canvas.id,
        name: canvas.name,
        thumbnail: canvas.thumbnail,
        createdAt: new Date(canvas.createdAt),
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: canvases.id,
        set: {
          name: canvas.name,
          thumbnail: canvas.thumbnail,
          updatedAt: now,
        },
      });

    // Delete existing nodes and edges
    await this.db.delete(canvasNodes).where(eq(canvasNodes.canvasId, canvas.id));
    await this.db.delete(canvasEdges).where(eq(canvasEdges.canvasId, canvas.id));

    // Insert nodes
    if (canvas.nodes.length > 0) {
      await this.db.insert(canvasNodes).values(
        canvas.nodes.map(n => ({
          id: n.id,
          canvasId: canvas.id,
          type: n.type || 'unknown',
          positionX: n.position.x,
          positionY: n.position.y,
          width: n.width,
          height: n.height,
          data: n.data,
          createdAt: now,
          updatedAt: now,
        }))
      );
    }

    // Insert edges
    if (canvas.edges.length > 0) {
      await this.db.insert(canvasEdges).values(
        canvas.edges.map(e => ({
          id: e.id,
          canvasId: canvas.id,
          sourceNodeId: e.source,
          sourceHandle: e.sourceHandle,
          targetNodeId: e.target,
          targetHandle: e.targetHandle,
          type: e.type,
        }))
      );
    }
  }

  async deleteCanvas(id: string): Promise<void> {
    // Cascading delete handles nodes and edges
    await this.db.delete(canvases).where(eq(canvases.id, id));
  }

  async canvasExists(id: string): Promise<boolean> {
    const [result] = await this.db
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
SQLITE_URL=file:./data/koda.db
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

## Option 3: PostgreSQL

For teams or existing PostgreSQL infrastructure.

### Local PostgreSQL

\`\`\`bash
# Start PostgreSQL with Docker
docker-compose up -d postgres

# Or use existing PostgreSQL
# .env.local
NEXT_PUBLIC_STORAGE_BACKEND=postgres
DATABASE_URL=postgres://user:pass@localhost:5432/koda
\`\`\`

### Supabase (Hosted PostgreSQL)

1. Create project at https://supabase.com
2. Get connection string from Settings → Database

\`\`\`bash
# .env.local
NEXT_PUBLIC_STORAGE_BACKEND=postgres
DATABASE_URL=postgres://postgres:xxx@db.xxx.supabase.co:5432/postgres
\`\`\`

### Neon (Serverless PostgreSQL)

1. Create project at https://neon.tech
2. Get connection string

\`\`\`bash
# .env.local
NEXT_PUBLIC_STORAGE_BACKEND=postgres
DATABASE_URL=postgres://user:pass@ep-xxx.neon.tech/koda
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
      - SQLITE_URL=file:/data/koda.db
    volumes:
      - koda-data:/data

volumes:
  koda-data:
\`\`\`

## Comparison

| Backend | Setup | Persistence | Sync | Cost |
|---------|-------|-------------|------|------|
| localStorage | None | Browser only | ❌ | Free |
| SQLite (local) | 1 env var | File | ❌ | Free |
| Turso | Account | Cloud | ✅ | Free tier |
| PostgreSQL | Server | Server | ✅ | Varies |
| Supabase | Account | Cloud | ✅ | Free tier |
```

---

## Next Steps

1. **Review this plan** - Any changes to schema or approach?
2. **Start Phase 1** - Add dependencies and basic schema
3. **Test with SQLite first** - Simplest path to validate architecture
4. **Add PostgreSQL** - After SQLite works

Questions to decide:
- [ ] Do you want users table for self-hosted (local auth) or hosted-only?
- [ ] Should we store nodes/edges as JSON blob or normalized tables?
- [ ] Which cloud asset storage for hosted version (S3, R2, Supabase)?
