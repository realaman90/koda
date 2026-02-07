/**
 * Database Module
 * 
 * This module is SERVER-ONLY. Do not import it from client components.
 * It uses Node.js APIs (fs, better-sqlite3) that don't exist in browsers.
 */
import 'server-only';

import * as schema from './schema';

// Singleton instances (typed as any for flexibility with different drivers)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let db: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let betterSqliteDb: any = null;

/**
 * Get database configuration from environment variables
 * 
 * Priority:
 * 1. TURSO_DATABASE_URL + TURSO_AUTH_TOKEN (Turso cloud)
 * 2. SQLITE_PATH (local file)
 * 3. Default: ./data/koda.db
 */
export function getDatabaseConfig() {
  // Check for Turso cloud configuration first
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoToken = process.env.TURSO_AUTH_TOKEN;
  
  if (tursoUrl) {
    return {
      url: tursoUrl,
      authToken: tursoToken,
      type: 'turso' as const,
      isLocal: false,
      path: null as string | null,
    };
  }
  
  // Fall back to local SQLite file
  const sqlitePath = process.env.SQLITE_PATH || './data/koda.db';
  
  return {
    url: `file:${sqlitePath}`,
    authToken: undefined,
    type: 'local' as const,
    isLocal: true,
    path: sqlitePath,
  };
}

/**
 * Get the Drizzle database instance (singleton, async)
 * 
 * Uses better-sqlite3 for local files (Node.js native)
 * Uses @libsql/client for Turso cloud
 * 
 * SERVER-ONLY: Only call this from API routes or server components
 */
export async function getDatabaseAsync() {
  if (db) return db;
  
  const config = getDatabaseConfig();
  
  if (config.isLocal && config.path) {
    // Dynamic imports to avoid bundling for client
    const fs = await import('fs');
    const path = await import('path');
    const { drizzle } = await import('drizzle-orm/better-sqlite3');
    const Database = (await import('better-sqlite3')).default;
    
    // Ensure directory exists
    const dir = path.dirname(config.path);
    if (dir && dir !== '.' && !fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    betterSqliteDb = new Database(config.path);
    db = drizzle(betterSqliteDb, { schema });
  } else {
    // Use libsql client for Turso cloud
    const { drizzle } = await import('drizzle-orm/libsql');
    const { createClient } = await import('@libsql/client/web');
    const client = createClient({
      url: config.url,
      authToken: config.authToken,
    });
    db = drizzle(client, { schema });
  }
  
  return db;
}

/**
 * Get the Drizzle database instance (singleton, sync - throws if not initialized)
 * Call getDatabaseAsync() first to initialize
 */
export function getDatabase() {
  if (!db) {
    throw new Error('Database not initialized. Call getDatabaseAsync() first.');
  }
  return db;
}

/**
 * Get the raw better-sqlite3 client (for migrations)
 * Only available for local SQLite, returns null for Turso
 */
export function getBetterSqliteClient() {
  return betterSqliteDb;
}

/**
 * Close the database connection
 * Useful for cleanup in scripts
 */
export function closeDatabase() {
  if (betterSqliteDb) {
    betterSqliteDb.close();
    betterSqliteDb = null;
  }
  db = null;
}

// Re-export schema for convenience
export { schema };
export * from './schema';
