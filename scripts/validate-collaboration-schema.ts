import { execSync } from 'child_process';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const dbPath = path.resolve('.tmp/collaboration-validation.db');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

execSync(`SQLITE_PATH=${dbPath} npx tsx src/lib/db/migrate.ts`, {
  stdio: 'inherit',
  env: { ...process.env, SQLITE_PATH: dbPath, TURSO_DATABASE_URL: '', TURSO_AUTH_TOKEN: '' },
});

const db = new Database(dbPath);

const expect = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
};

const requiredTables = [
  'users',
  'workspaces',
  'workspace_members',
  'workspace_invites',
  'projects',
  'canvases',
  'audit_logs',
];

for (const table of requiredTables) {
  const row = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?")
    .get(table) as { name?: string } | undefined;
  expect(row?.name === table, `Missing table: ${table}`);
}

const now = Date.now();

// users uniqueness
const insertUser = db.prepare(
  `INSERT INTO users (id, clerk_user_id, email, first_name, last_name, image_url, created_at, updated_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
);
insertUser.run('u1', 'clerk_1', 'owner@example.com', 'Owner', 'One', null, now, now);
let duplicateUserBlocked = false;
try {
  insertUser.run('u2', 'clerk_1', 'dup@example.com', null, null, null, now, now);
} catch {
  duplicateUserBlocked = true;
}
expect(duplicateUserBlocked, 'Duplicate clerk_user_id should fail');

// workspace + member uniqueness
const insertWorkspace = db.prepare(
  `INSERT INTO workspaces (id, name, slug, type, owner_user_id, created_at, updated_at)
   VALUES (?, ?, ?, ?, ?, ?, ?)`
);
insertWorkspace.run('w1', 'Owner Personal', 'owner-personal', 'personal', 'u1', now, now);

const insertMember = db.prepare(
  `INSERT INTO workspace_members (id, workspace_id, user_id, role, created_at, updated_at)
   VALUES (?, ?, ?, ?, ?, ?)`
);
insertMember.run('m1', 'w1', 'u1', 'owner', now, now);
let duplicateMembershipBlocked = false;
try {
  insertMember.run('m2', 'w1', 'u1', 'admin', now, now);
} catch {
  duplicateMembershipBlocked = true;
}
expect(duplicateMembershipBlocked, 'Duplicate workspace membership should fail');

// invite CRUD + pending lookup index path
const insertInvite = db.prepare(
  `INSERT INTO workspace_invites
   (id, workspace_id, email, role, status, token, invited_by_user_id, expires_at, accepted_at, revoked_at, created_at, updated_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
);
insertInvite.run('i1', 'w1', 'editor@example.com', 'editor', 'pending', 'tok_1', 'u1', now + 86_400_000, null, null, now, now);
const pendingInvite = db
  .prepare(
    `SELECT id FROM workspace_invites WHERE workspace_id = ? AND email = ? AND status = 'pending' LIMIT 1`
  )
  .get('w1', 'editor@example.com') as { id?: string } | undefined;
expect(pendingInvite?.id === 'i1', 'Pending invite lookup failed');

// projects / canvases workspace ownership fields
const insertProject = db.prepare(
  `INSERT INTO projects (id, workspace_id, owner_user_id, name, description, created_at, updated_at)
   VALUES (?, ?, ?, ?, ?, ?, ?)`
);
insertProject.run('p1', 'w1', 'u1', 'Main Project', null, now, now);

const insertCanvas = db.prepare(
  `INSERT INTO canvases (id, workspace_id, owner_user_id, project_id, name, nodes, edges, created_at, updated_at, thumbnail_status)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
);
insertCanvas.run('c1', 'w1', 'u1', 'p1', 'Workspace Canvas', '[]', '[]', now, now, 'empty');

// audit CRUD
const insertAudit = db.prepare(
  `INSERT INTO audit_logs (id, workspace_id, actor_user_id, action, target_type, target_id, metadata, created_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
);
insertAudit.run('a1', 'w1', 'u1', 'workspace.created', 'workspace', 'w1', '{"source":"test"}', now);
const auditCount = db.prepare(`SELECT COUNT(*) AS count FROM audit_logs WHERE workspace_id = ?`).get('w1') as {
  count: number;
};
expect(auditCount.count === 1, 'Audit log insert failed');

console.log('✅ Collaboration schema validation passed');
db.close();
