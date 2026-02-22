import 'dotenv/config';

import fs from 'fs';
import path from 'path';

type MigrationReport = {
  usersProcessed: number;
  workspacesCreated: number;
  membershipsCreated: number;
  projectsUpdated: number;
  canvasesUpdated: number;
};

type UserRow = {
  id: string;
  email: string;
  first_name: string | null;
};

type DatabaseConfig = {
  type: 'local' | 'turso';
  isLocal: boolean;
  path?: string;
  url: string;
  authToken?: string;
};

const dryRun = process.argv.includes('--dry-run');

function getDatabaseConfig(): DatabaseConfig {
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoToken = process.env.TURSO_AUTH_TOKEN;

  if (tursoUrl && tursoUrl.startsWith('libsql://')) {
    return {
      type: 'turso',
      isLocal: false,
      url: tursoUrl,
      authToken: tursoToken,
    };
  }

  const sqlitePath = process.env.SQLITE_PATH || './data/koda.db';
  return {
    type: 'local',
    isLocal: true,
    path: sqlitePath,
    url: sqlitePath.startsWith('file:') ? sqlitePath : `file:${sqlitePath}`,
  };
}

function personalWorkspaceId(userId: string) {
  return `ws_personal_${userId}`;
}

function workspaceName(email: string, firstName: string | null) {
  if (firstName?.trim()) return `${firstName.trim()}'s Workspace`;
  return `${email.split('@')[0]}'s Workspace`;
}

async function runLocal(dbPath: string, dryRun: boolean, report: MigrationReport) {
  const Database = (await import('better-sqlite3')).default;
  const dbDir = path.dirname(dbPath);
  if (dbDir && dbDir !== '.' && !fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
  const db = new Database(dbPath);
  const now = Date.now();

  try {
    const users = db.prepare('SELECT id, email, first_name FROM users').all() as UserRow[];
    report.usersProcessed = users.length;

    for (const user of users) {
      const wsId = personalWorkspaceId(user.id);
      const workspace = db.prepare('SELECT id FROM workspaces WHERE id = ?').get(wsId) as { id?: string } | undefined;

      if (!workspace) {
        report.workspacesCreated += 1;
        if (!dryRun) {
          db.prepare(
            `INSERT INTO workspaces (id, name, slug, type, owner_user_id, created_at, updated_at)
             VALUES (?, ?, NULL, 'personal', ?, ?, ?)`
          ).run(wsId, workspaceName(user.email, user.first_name), user.id, now, now);
        }
      }

      const member = db
        .prepare('SELECT id FROM workspace_members WHERE workspace_id = ? AND user_id = ?')
        .get(wsId, user.id) as { id?: string } | undefined;

      if (!member) {
        report.membershipsCreated += 1;
        if (!dryRun) {
          db.prepare(
            `INSERT INTO workspace_members (id, workspace_id, user_id, role, created_at, updated_at)
             VALUES (?, ?, ?, 'owner', ?, ?)`
          ).run(`wm_${wsId}_${user.id}`, wsId, user.id, now, now);
        }
      }
    }

    const fallbackUserId = users[0]?.id;
    if (!fallbackUserId) return;

    const legacyProjects = db
      .prepare('SELECT id, owner_user_id FROM projects WHERE workspace_id IS NULL')
      .all() as Array<{ id: string; owner_user_id: string | null }>;

    for (const project of legacyProjects) {
      const ownerUserId = project.owner_user_id || fallbackUserId;
      report.projectsUpdated += 1;
      if (!dryRun) {
        db.prepare(
          `UPDATE projects SET owner_user_id = ?, workspace_id = ?, updated_at = ? WHERE id = ?`
        ).run(ownerUserId, personalWorkspaceId(ownerUserId), now, project.id);
      }
    }

    const legacyCanvases = db
      .prepare('SELECT id, owner_user_id FROM canvases WHERE workspace_id IS NULL')
      .all() as Array<{ id: string; owner_user_id: string | null }>;

    for (const canvas of legacyCanvases) {
      const ownerUserId = canvas.owner_user_id || fallbackUserId;
      report.canvasesUpdated += 1;
      if (!dryRun) {
        db.prepare(
          `UPDATE canvases SET owner_user_id = ?, workspace_id = ?, updated_at = ? WHERE id = ?`
        ).run(ownerUserId, personalWorkspaceId(ownerUserId), now, canvas.id);
      }
    }
  } finally {
    db.close();
  }
}

async function runTurso(url: string, authToken: string | undefined, dryRun: boolean, report: MigrationReport) {
  const { createClient } = await import('@libsql/client/web');
  const client = createClient({ url, authToken });
  const now = Date.now();

  try {
    const usersResult = await client.execute('SELECT id, email, first_name FROM users');
    const users = usersResult.rows as unknown as UserRow[];
    report.usersProcessed = users.length;

    for (const user of users) {
      const wsId = personalWorkspaceId(user.id);
      const workspaceResult = await client.execute({
        sql: 'SELECT id FROM workspaces WHERE id = ?',
        args: [wsId],
      });

      if (workspaceResult.rows.length === 0) {
        report.workspacesCreated += 1;
        if (!dryRun) {
          await client.execute({
            sql: `INSERT INTO workspaces (id, name, slug, type, owner_user_id, created_at, updated_at)
                  VALUES (?, ?, NULL, 'personal', ?, ?, ?)`,
            args: [wsId, workspaceName(user.email, user.first_name), user.id, now, now],
          });
        }
      }

      const memberResult = await client.execute({
        sql: 'SELECT id FROM workspace_members WHERE workspace_id = ? AND user_id = ?',
        args: [wsId, user.id],
      });

      if (memberResult.rows.length === 0) {
        report.membershipsCreated += 1;
        if (!dryRun) {
          await client.execute({
            sql: `INSERT INTO workspace_members (id, workspace_id, user_id, role, created_at, updated_at)
                  VALUES (?, ?, ?, 'owner', ?, ?)`,
            args: [`wm_${wsId}_${user.id}`, wsId, user.id, now, now],
          });
        }
      }
    }

    const fallbackUserId = users[0]?.id;
    if (!fallbackUserId) return;

    const legacyProjects = await client.execute('SELECT id, owner_user_id FROM projects WHERE workspace_id IS NULL');
    for (const project of legacyProjects.rows as unknown as Array<{ id: string; owner_user_id: string | null }>) {
      const ownerUserId = project.owner_user_id || fallbackUserId;
      report.projectsUpdated += 1;
      if (!dryRun) {
        await client.execute({
          sql: 'UPDATE projects SET owner_user_id = ?, workspace_id = ?, updated_at = ? WHERE id = ?',
          args: [ownerUserId, personalWorkspaceId(ownerUserId), now, project.id],
        });
      }
    }

    const legacyCanvases = await client.execute('SELECT id, owner_user_id FROM canvases WHERE workspace_id IS NULL');
    for (const canvas of legacyCanvases.rows as unknown as Array<{ id: string; owner_user_id: string | null }>) {
      const ownerUserId = canvas.owner_user_id || fallbackUserId;
      report.canvasesUpdated += 1;
      if (!dryRun) {
        await client.execute({
          sql: 'UPDATE canvases SET owner_user_id = ?, workspace_id = ?, updated_at = ? WHERE id = ?',
          args: [ownerUserId, personalWorkspaceId(ownerUserId), now, canvas.id],
        });
      }
    }
  } finally {
    client.close();
  }
}

async function main() {
  const report: MigrationReport = {
    usersProcessed: 0,
    workspacesCreated: 0,
    membershipsCreated: 0,
    projectsUpdated: 0,
    canvasesUpdated: 0,
  };

  console.log(`🚚 Starting legacy-to-workspace backfill (${dryRun ? 'dry-run' : 'write'})`);

  const config = getDatabaseConfig();
  if (config.isLocal && config.path) {
    await runLocal(config.path, dryRun, report);
  } else {
    await runTurso(config.url, config.authToken, dryRun, report);
  }

  console.log('📊 Migration report');
  console.table(report);
  console.log(dryRun ? '✅ Dry-run completed (no writes).' : '✅ Backfill completed successfully.');
}

main().catch((error) => {
  console.error('❌ Backfill failed:', error);
  process.exit(1);
});
