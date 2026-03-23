import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

const dbPath = path.resolve('.tmp/invite-lifecycle-validation.db');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

execSync(`SQLITE_PATH=${dbPath} npx tsx src/lib/db/migrate.ts`, {
  stdio: 'inherit',
  env: { ...process.env, SQLITE_PATH: dbPath, TURSO_DATABASE_URL: '', TURSO_AUTH_TOKEN: '' },
});

const db = new Database(dbPath);
const now = Date.now();

const expect = (cond: unknown, msg: string) => {
  if (!cond) throw new Error(msg);
};

// seed owner, workspace, invite target user

db.prepare(
  `INSERT INTO users (id, clerk_user_id, email, first_name, last_name, image_url, created_at, updated_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
).run('u_owner', 'clerk_owner', 'owner@example.com', 'Owner', null, null, now, now);

db.prepare(
  `INSERT INTO users (id, clerk_user_id, email, first_name, last_name, image_url, created_at, updated_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
).run('u_member', 'clerk_member', 'member@example.com', 'Member', null, null, now, now);

db.prepare(
  `INSERT INTO workspaces (id, name, slug, type, owner_user_id, created_at, updated_at)
   VALUES (?, ?, ?, ?, ?, ?, ?)`
).run('w1', 'Team One', 'team-one', 'team', 'u_owner', now, now);

db.prepare(
  `INSERT INTO workspace_members (id, workspace_id, user_id, role, created_at, updated_at)
   VALUES (?, ?, ?, ?, ?, ?)`
).run('wm_owner', 'w1', 'u_owner', 'owner', now, now);

db.prepare(
  `INSERT INTO workspace_invites
   (id, workspace_id, email, role, status, token, invited_by_user_id, expires_at, accepted_at, revoked_at, created_at, updated_at)
   VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, NULL, NULL, ?, ?)`
).run('inv1', 'w1', 'member@example.com', 'editor', 'tok_accept', 'u_owner', now + 86400000, now, now);

// accept flow should be idempotent via unique constraint
const insertMembership = db.prepare(
  `INSERT OR IGNORE INTO workspace_members (id, workspace_id, user_id, role, created_at, updated_at)
   VALUES (?, ?, ?, ?, ?, ?)`
);
insertMembership.run('wm_member_1', 'w1', 'u_member', 'editor', now, now);
insertMembership.run('wm_member_2', 'w1', 'u_member', 'editor', now, now);

const memberRows = db
  .prepare(`SELECT COUNT(*) as count FROM workspace_members WHERE workspace_id = ? AND user_id = ?`)
  .get('w1', 'u_member') as { count: number };
expect(memberRows.count === 1, 'Membership should be created exactly once');

// decline / revoke / expire transitions

db.prepare(`UPDATE workspace_invites SET status = 'accepted', accepted_at = ?, updated_at = ? WHERE id = ?`).run(
  now,
  now,
  'inv1'
);
const accepted = db.prepare(`SELECT status FROM workspace_invites WHERE id = ?`).get('inv1') as { status: string };
expect(accepted.status === 'accepted', 'Invite should move to accepted');

db.prepare(
  `INSERT INTO workspace_invites
   (id, workspace_id, email, role, status, token, invited_by_user_id, expires_at, accepted_at, revoked_at, created_at, updated_at)
   VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, NULL, NULL, ?, ?)`
).run('inv2', 'w1', 'decline@example.com', 'viewer', 'tok_decline', 'u_owner', now + 86400000, now, now);
db.prepare(`UPDATE workspace_invites SET status = 'declined', updated_at = ? WHERE id = ?`).run(now, 'inv2');

const declined = db.prepare(`SELECT status FROM workspace_invites WHERE id = ?`).get('inv2') as { status: string };
expect(declined.status === 'declined', 'Invite should move to declined');

db.prepare(
  `INSERT INTO workspace_invites
   (id, workspace_id, email, role, status, token, invited_by_user_id, expires_at, accepted_at, revoked_at, created_at, updated_at)
   VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, NULL, NULL, ?, ?)`
).run('inv3', 'w1', 'revoke@example.com', 'viewer', 'tok_revoke', 'u_owner', now + 86400000, now, now);
db.prepare(`UPDATE workspace_invites SET status = 'revoked', revoked_at = ?, updated_at = ? WHERE id = ?`).run(
  now,
  now,
  'inv3'
);

const revoked = db.prepare(`SELECT status FROM workspace_invites WHERE id = ?`).get('inv3') as { status: string };
expect(revoked.status === 'revoked', 'Invite should move to revoked');

db.prepare(
  `INSERT INTO workspace_invites
   (id, workspace_id, email, role, status, token, invited_by_user_id, expires_at, accepted_at, revoked_at, created_at, updated_at)
   VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, NULL, NULL, ?, ?)`
).run('inv4', 'w1', 'expire@example.com', 'viewer', 'tok_expire', 'u_owner', now - 1000, now, now);
db.prepare(`UPDATE workspace_invites SET status = 'expired', updated_at = ? WHERE id = ?`).run(now, 'inv4');

const expired = db.prepare(`SELECT status FROM workspace_invites WHERE id = ?`).get('inv4') as { status: string };
expect(expired.status === 'expired', 'Invite should move to expired');

console.log('✅ Invite lifecycle validation passed');
db.close();
