import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

const dbPath = path.resolve('.tmp/backfill-validation.db');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

function run(command: string) {
  execSync(command, {
    stdio: 'inherit',
    env: {
      ...process.env,
      SQLITE_PATH: dbPath,
      TURSO_DATABASE_URL: '',
      TURSO_AUTH_TOKEN: '',
    },
  });
}

run(`SQLITE_PATH=${dbPath} npx tsx src/lib/db/migrate.ts`);

const db = new Database(dbPath);
const now = Date.now();

// seed legacy-style data
const insertUser = db.prepare(
  `INSERT INTO users (id, clerk_user_id, email, first_name, last_name, image_url, created_at, updated_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
);
insertUser.run('u1', 'clerk_legacy_1', 'legacy@example.com', 'Legacy', 'User', null, now, now);

const insertProject = db.prepare(
  `INSERT INTO projects (id, workspace_id, owner_user_id, name, description, created_at, updated_at)
   VALUES (?, NULL, ?, ?, ?, ?, ?)`
);
insertProject.run('p1', 'u1', 'Legacy Project', null, now, now);

const insertCanvas = db.prepare(
  `INSERT INTO canvases (id, workspace_id, owner_user_id, project_id, name, nodes, edges, created_at, updated_at, thumbnail_status)
   VALUES (?, NULL, NULL, ?, ?, '[]', '[]', ?, ?, 'empty')`
);
insertCanvas.run('c1', 'p1', 'Legacy Canvas', now, now);

run(`SQLITE_PATH=${dbPath} npx tsx scripts/backfill-workspaces.ts --dry-run`);
run(`SQLITE_PATH=${dbPath} npx tsx scripts/backfill-workspaces.ts`);

const snapshotAfterFirst = {
  workspaces: db.prepare('SELECT COUNT(*) as count FROM workspaces').get() as { count: number },
  memberships: db.prepare('SELECT COUNT(*) as count FROM workspace_members').get() as { count: number },
  projectsScoped: db.prepare('SELECT COUNT(*) as count FROM projects WHERE workspace_id IS NOT NULL').get() as {
    count: number;
  },
  canvasesScoped: db.prepare('SELECT COUNT(*) as count FROM canvases WHERE workspace_id IS NOT NULL').get() as {
    count: number;
  },
};

run(`SQLITE_PATH=${dbPath} npx tsx scripts/backfill-workspaces.ts`);

const snapshotAfterSecond = {
  workspaces: db.prepare('SELECT COUNT(*) as count FROM workspaces').get() as { count: number },
  memberships: db.prepare('SELECT COUNT(*) as count FROM workspace_members').get() as { count: number },
  projectsScoped: db.prepare('SELECT COUNT(*) as count FROM projects WHERE workspace_id IS NOT NULL').get() as {
    count: number;
  },
  canvasesScoped: db.prepare('SELECT COUNT(*) as count FROM canvases WHERE workspace_id IS NOT NULL').get() as {
    count: number;
  },
};

if (JSON.stringify(snapshotAfterFirst) !== JSON.stringify(snapshotAfterSecond)) {
  throw new Error('Backfill is not idempotent across consecutive runs');
}

if (snapshotAfterFirst.workspaces.count !== 1) {
  throw new Error('Expected exactly one personal workspace for seeded user');
}

console.log('✅ Backfill validation passed (dry-run + idempotency)');
db.close();
