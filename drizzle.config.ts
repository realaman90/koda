import { defineConfig } from 'drizzle-kit';

// Get database URL from environment
const getDatabaseUrl = () => {
  // Turso cloud takes priority
  if (process.env.TURSO_DATABASE_URL) {
    return process.env.TURSO_DATABASE_URL;
  }
  
  // Local SQLite file
  const sqlitePath = process.env.SQLITE_PATH || './data/koda.db';
  return sqlitePath.startsWith('file:') ? sqlitePath : `file:${sqlitePath}`;
};

export default defineConfig({
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: getDatabaseUrl(),
  },
});
