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
  `CREATE TABLE IF NOT EXISTS canvases (
    id TEXT PRIMARY KEY,
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
  `ALTER TABLE canvases ADD COLUMN thumbnail_url TEXT`,
  `ALTER TABLE canvases ADD COLUMN thumbnail_status TEXT NOT NULL DEFAULT 'empty'`,
  `ALTER TABLE canvases ADD COLUMN thumbnail_updated_at INTEGER`,
  `ALTER TABLE canvases ADD COLUMN thumbnail_version TEXT`,
  `ALTER TABLE canvases ADD COLUMN thumbnail_error_code TEXT`,
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
