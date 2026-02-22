/**
 * Database Migration Script
 * 
 * Run with: npm run db:migrate
 * 
 * This script:
 * 1. Creates the database file if it doesn't exist
 * 2. Creates the canvases table
 * 3. Creates the updated_at index
 * 
 * STANDALONE: This script does not import from ./index to avoid server-only restrictions
 */

// Load environment variables from .env file
import 'dotenv/config';

import * as fs from 'fs';
import * as path from 'path';

// Inline database config to avoid importing from ./index (which has server-only)
interface DatabaseConfig {
  type: 'local' | 'turso';
  isLocal: boolean;
  path?: string;
  url: string;
  authToken?: string;
}

function getDatabaseConfig(): DatabaseConfig {
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoToken = process.env.TURSO_AUTH_TOKEN;
  
  // If Turso is configured, use it
  if (tursoUrl && tursoUrl.startsWith('libsql://')) {
    return {
      type: 'turso',
      isLocal: false,
      url: tursoUrl,
      authToken: tursoToken,
    };
  }
  
  // Default to local SQLite
  const sqlitePath = process.env.SQLITE_PATH || './data/koda.db';
  
  return {
    type: 'local',
    isLocal: true,
    path: sqlitePath,
    url: sqlitePath.startsWith('file:') ? sqlitePath : `file:${sqlitePath}`,
  };
}

const SCHEMA_SQL_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    clerk_user_id TEXT NOT NULL,
    email TEXT NOT NULL,
    first_name TEXT,
    last_name TEXT,
    image_url TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS users_clerk_user_id_unique ON users(clerk_user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_users_clerk_user_id ON users(clerk_user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`,
  `CREATE TABLE IF NOT EXISTS workspaces (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT,
    type TEXT NOT NULL DEFAULT 'personal',
    owner_user_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS workspaces_slug_unique ON workspaces(slug)`,
  `CREATE INDEX IF NOT EXISTS idx_workspaces_owner ON workspaces(owner_user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_workspaces_type ON workspaces(type)`,
  `CREATE TABLE IF NOT EXISTS workspace_members (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'viewer',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS workspace_members_workspace_user_unique ON workspace_members(workspace_id, user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace_role ON workspace_members(workspace_id, role)`,
  `CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON workspace_members(user_id)`,
  `CREATE TABLE IF NOT EXISTS workspace_invites (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'viewer',
    status TEXT NOT NULL DEFAULT 'pending',
    token TEXT NOT NULL,
    invited_by_user_id TEXT NOT NULL,
    expires_at INTEGER,
    accepted_at INTEGER,
    revoked_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS workspace_invites_token_unique ON workspace_invites(token)`,
  `CREATE INDEX IF NOT EXISTS idx_workspace_invites_workspace_email_status ON workspace_invites(workspace_id, email, status)`,
  `CREATE INDEX IF NOT EXISTS idx_workspace_invites_workspace_status ON workspace_invites(workspace_id, status)`,
  `CREATE INDEX IF NOT EXISTS idx_workspace_invites_email_status ON workspace_invites(email, status)`,
  `CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    owner_user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_projects_workspace ON projects(workspace_id)`,
  `CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(owner_user_id)`,
  `CREATE TABLE IF NOT EXISTS canvases (
    id TEXT PRIMARY KEY,
    workspace_id TEXT,
    owner_user_id TEXT,
    project_id TEXT,
    name TEXT NOT NULL,
    nodes TEXT,
    edges TEXT,
    thumbnail TEXT,
    thumbnail_url TEXT,
    thumbnail_status TEXT NOT NULL DEFAULT 'empty',
    thumbnail_updated_at INTEGER,
    thumbnail_version TEXT,
    thumbnail_error_code TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    actor_user_id TEXT NOT NULL,
    action TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    metadata TEXT,
    created_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_audit_logs_workspace_created ON audit_logs(workspace_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON audit_logs(target_type, target_id)`,
  `CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action)`,
  `CREATE INDEX IF NOT EXISTS idx_canvases_updated ON canvases(updated_at DESC)`,
  `CREATE TABLE IF NOT EXISTS animation_projects (
    id TEXT PRIMARY KEY,
    canvas_id TEXT,
    engine TEXT,
    plan TEXT,
    active_version_id TEXT,
    sandbox_id TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS animation_versions (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    video_url TEXT,
    snapshot_key TEXT,
    thumbnail_url TEXT,
    prompt TEXT,
    duration INTEGER,
    size_bytes INTEGER,
    created_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_animation_versions_project ON animation_versions(project_id, created_at DESC)`,
];

const CANVAS_COLUMN_MIGRATIONS = [
  `ALTER TABLE canvases ADD COLUMN workspace_id TEXT`,
  `ALTER TABLE canvases ADD COLUMN owner_user_id TEXT`,
  `ALTER TABLE canvases ADD COLUMN project_id TEXT`,
  `ALTER TABLE canvases ADD COLUMN thumbnail_url TEXT`,
  `ALTER TABLE canvases ADD COLUMN thumbnail_status TEXT NOT NULL DEFAULT 'empty'`,
  `ALTER TABLE canvases ADD COLUMN thumbnail_updated_at INTEGER`,
  `ALTER TABLE canvases ADD COLUMN thumbnail_version TEXT`,
  `ALTER TABLE canvases ADD COLUMN thumbnail_error_code TEXT`,
];

const POST_COLUMN_INDEX_SQL = [
  `CREATE INDEX IF NOT EXISTS idx_canvases_workspace ON canvases(workspace_id)`,
  `CREATE INDEX IF NOT EXISTS idx_canvases_workspace_updated ON canvases(workspace_id, updated_at)`,
  `CREATE INDEX IF NOT EXISTS idx_canvases_owner ON canvases(owner_user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_canvases_project ON canvases(project_id)`,
];

const CANVAS_BACKFILL_SQL = [
  `UPDATE canvases
   SET thumbnail_url = COALESCE(thumbnail_url, thumbnail)
   WHERE thumbnail_url IS NULL AND thumbnail IS NOT NULL`,
  `UPDATE canvases
   SET thumbnail_status = CASE
     WHEN (thumbnail_url IS NOT NULL AND TRIM(thumbnail_url) != '') OR (thumbnail IS NOT NULL AND TRIM(thumbnail) != '') THEN 'ready'
     ELSE 'empty'
   END
   WHERE thumbnail_status IS NULL OR TRIM(thumbnail_status) = '' OR thumbnail_status = 'empty'`,
];

async function migrateLocal(dbPath: string) {
  console.log('📁 Using better-sqlite3 for local database\n');
  
  // Ensure directory exists
  const dbDir = path.dirname(dbPath);
  if (dbDir && dbDir !== '.' && !fs.existsSync(dbDir)) {
    console.log(`📂 Creating directory: ${dbDir}`);
    fs.mkdirSync(dbDir, { recursive: true });
  }
  
  // Use better-sqlite3
  const Database = (await import('better-sqlite3')).default;
  const db = new Database(dbPath);
  
  try {
    console.log('📝 Creating tables...');
    
    for (const sql of SCHEMA_SQL_STATEMENTS) {
      db.exec(sql);
    }

    for (const sql of CANVAS_COLUMN_MIGRATIONS) {
      try {
        db.exec(sql);
      } catch {
        // Column already exists (safe to ignore)
      }
    }

    for (const sql of POST_COLUMN_INDEX_SQL) {
      db.exec(sql);
    }

    for (const sql of CANVAS_BACKFILL_SQL) {
      db.exec(sql);
    }
    
    console.log('✅ Tables created successfully!\n');
    
    // Verify tables exist
    const result = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='canvases'").all();
    
    if (result.length > 0) {
      console.log('✅ Verified: canvases table exists');
    } else {
      console.error('❌ Error: canvases table was not created');
      process.exit(1);
    }
    
    // Count existing records
    const countResult = db.prepare('SELECT COUNT(*) as count FROM canvases').get() as { count: number };
    console.log(`📊 Current canvas count: ${countResult?.count ?? 0}\n`);
    
    console.log('🎉 Migration completed successfully!');
  } finally {
    db.close();
  }
}

async function migrateTurso(url: string, authToken?: string) {
  console.log('☁️  Using libsql client for Turso cloud\n');
  
  const { createClient } = await import('@libsql/client/web');
  const client = createClient({ url, authToken });
  
  try {
    console.log('📝 Creating tables...');
    
    for (const sql of SCHEMA_SQL_STATEMENTS) {
      await client.execute(sql);
    }

    for (const sql of CANVAS_COLUMN_MIGRATIONS) {
      try {
        await client.execute(sql);
      } catch {
        // Column already exists (safe to ignore)
      }
    }

    for (const sql of POST_COLUMN_INDEX_SQL) {
      await client.execute(sql);
    }

    for (const sql of CANVAS_BACKFILL_SQL) {
      await client.execute(sql);
    }
    
    console.log('✅ Tables created successfully!\n');
    
    // Verify tables exist
    const result = await client.execute(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='canvases'"
    );
    
    if (result.rows.length > 0) {
      console.log('✅ Verified: canvases table exists');
    } else {
      console.error('❌ Error: canvases table was not created');
      process.exit(1);
    }
    
    // Count existing records
    const countResult = await client.execute('SELECT COUNT(*) as count FROM canvases');
    const count = countResult.rows[0]?.count ?? 0;
    console.log(`📊 Current canvas count: ${count}\n`);
    
    console.log('🎉 Migration completed successfully!');
  } finally {
    client.close();
  }
}

async function migrate() {
  console.log('🚀 Starting database migration...\n');
  
  const config = getDatabaseConfig();
  console.log(`📁 Database type: ${config.type}`);
  console.log(`📍 Location: ${config.path || config.url}\n`);
  
  try {
    if (config.isLocal && config.path) {
      await migrateLocal(config.path);
    } else {
      await migrateTurso(config.url, config.authToken);
    }
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migrate();
