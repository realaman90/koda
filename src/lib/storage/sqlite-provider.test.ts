import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

import Database from 'better-sqlite3';

import { getSQLiteStorageProvider } from './sqlite-provider';
import { closeDatabase } from '../db';

function createTempDbPath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'koda-preview-test-'));
  return {
    dir,
    dbPath: path.join(dir, 'koda.db'),
  };
}

test('migration backfills legacy thumbnail columns safely', async (t) => {
  const { dir, dbPath } = createTempDbPath();

  t.after(() => {
    closeDatabase();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  // Simulate legacy schema before preview lifecycle fields existed.
  const seedDb = new Database(dbPath);
  seedDb.exec(`
    CREATE TABLE canvases (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      nodes TEXT,
      edges TEXT,
      thumbnail TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  seedDb.prepare(`
    INSERT INTO canvases (id, name, nodes, edges, thumbnail, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run('legacy_canvas', 'Legacy', '[]', '[]', 'https://cdn.example.com/legacy.jpg', Date.now(), Date.now());
  seedDb.close();

  execFileSync('node', ['--import', 'tsx', 'src/lib/db/migrate.ts'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      SQLITE_PATH: dbPath,
      TURSO_DATABASE_URL: '',
      TURSO_AUTH_TOKEN: '',
    },
    stdio: 'pipe',
  });

  const migratedDb = new Database(dbPath, { readonly: true });
  const row = migratedDb
    .prepare('SELECT thumbnail_url, thumbnail_status FROM canvases WHERE id = ?')
    .get('legacy_canvas') as { thumbnail_url: string | null; thumbnail_status: string | null };
  migratedDb.close();

  assert.equal(row.thumbnail_url, 'https://cdn.example.com/legacy.jpg');
  assert.equal(row.thumbnail_status, 'ready');
});

test('sqlite provider persists and hydrates preview lifecycle fields', async (t) => {
  const { dir, dbPath } = createTempDbPath();

  t.after(() => {
    closeDatabase();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  process.env.SQLITE_PATH = dbPath;
  process.env.TURSO_DATABASE_URL = '';
  process.env.TURSO_AUTH_TOKEN = '';

  execFileSync('node', ['--import', 'tsx', 'src/lib/db/migrate.ts'], {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'pipe',
  });

  const provider = getSQLiteStorageProvider();

  await provider.saveCanvas({
    id: 'canvas_roundtrip',
    name: 'Roundtrip',
    nodes: [],
    edges: [],
    thumbnail: 'https://cdn.example.com/preview.jpg',
    thumbnailUrl: 'https://cdn.example.com/preview.jpg',
    thumbnailStatus: 'processing',
    thumbnailUpdatedAt: Date.now(),
    thumbnailVersion: 'v-test',
    thumbnailErrorCode: undefined,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  const canvas = await provider.getCanvas('canvas_roundtrip');
  assert.ok(canvas);
  assert.equal(canvas.thumbnailUrl, 'https://cdn.example.com/preview.jpg');
  assert.equal(canvas.thumbnailStatus, 'processing');
  assert.equal(canvas.thumbnailVersion, 'v-test');

  const list = await provider.listCanvases();
  const listed = list.find((c) => c.id === 'canvas_roundtrip');
  assert.ok(listed);
  assert.equal(listed.thumbnailUrl, 'https://cdn.example.com/preview.jpg');
  assert.equal(listed.thumbnailStatus, 'processing');
  assert.equal(listed.thumbnailVersion, 'v-test');
});
