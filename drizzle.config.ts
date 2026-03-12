import 'dotenv/config';

import { defineConfig } from 'drizzle-kit';

function sanitizeEnv(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

const tursoUrl = sanitizeEnv(process.env.TURSO_DATABASE_URL);
const tursoAuthToken = sanitizeEnv(process.env.TURSO_AUTH_TOKEN);
const tablesFilter = sanitizeEnv(process.env.DRIZZLE_TABLES_FILTER)
  ?.split(',')
  .map((value) => value.trim())
  .filter(Boolean);

const sharedConfig = {
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
  ...(tablesFilter?.length ? { tablesFilter } : {}),
} as const;

const config = tursoUrl
  ? defineConfig({
      ...sharedConfig,
      dialect: 'turso',
      dbCredentials: {
        url: tursoUrl,
        authToken: tursoAuthToken,
      },
    })
  : (() => {
      const sqlitePath = sanitizeEnv(process.env.SQLITE_PATH) || './data/koda.db';
      const sqliteUrl = sqlitePath.startsWith('file:') ? sqlitePath : `file:${sqlitePath}`;

      return defineConfig({
        ...sharedConfig,
        dialect: 'sqlite',
        dbCredentials: {
          url: sqliteUrl,
        },
      });
  })();

export default config;
