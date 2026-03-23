import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import Database from 'better-sqlite3';

interface SmokeStepResult {
  name: string;
  status: 'pass' | 'fail';
  details?: Record<string, unknown>;
  error?: string;
}

interface OSSReleaseSmokeReport {
  mode: 'install' | 'upgrade' | 'all';
  startedAt: string;
  completedAt?: string;
  steps: SmokeStepResult[];
}

function isolatedEnv(overrides: Record<string, string | undefined> = {}): NodeJS.ProcessEnv {
  return {
    ...process.env,
    TURSO_DATABASE_URL: '',
    TURSO_AUTH_TOKEN: '',
    ...overrides,
  };
}

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (name: string, fallback?: string) => {
    const idx = args.indexOf(name);
    if (idx === -1) return fallback;
    return args[idx + 1] ?? fallback;
  };

  const mode = get('--mode', 'all');
  if (mode !== 'install' && mode !== 'upgrade' && mode !== 'all') {
    throw new Error(`Invalid --mode: ${mode}`);
  }

  const reportPath = get('--report', `reports/roadmap/phase4/oss-release-smoke-${Date.now()}.json`)!;
  const port = Number(get('--port', '4300'));
  if (!Number.isFinite(port) || port <= 0) {
    throw new Error(`Invalid --port: ${port}`);
  }

  return { mode, reportPath, port } as const;
}

function runCommand(command: string, args: string[], env: NodeJS.ProcessEnv = process.env): Promise<void> {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      env,
      stdio: 'inherit',
      shell: false,
    });

    child.on('exit', (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }
      rejectPromise(new Error(`${command} ${args.join(' ')} failed with code ${code}`));
    });
  });
}

async function waitForHealth(baseUrl: string, timeoutMs = 60_000) {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) {
        return response;
      }
    } catch {
      // server not up yet
    }

    await delay(1_000);
  }

  throw new Error(`Timed out waiting for ${baseUrl}/api/health`);
}

async function runInstallSmoke(port: number): Promise<SmokeStepResult> {
  const ts = Date.now();
  const tempRoot = resolve(`.tmp/oss-release-smoke/install-${ts}`);
  const envFile = resolve(tempRoot, '.env.smoke');
  const sqlitePath = resolve(tempRoot, 'data/koda-install-smoke.db');

  mkdirSync(dirname(envFile), { recursive: true });

  let server: ChildProcess | undefined;

  try {
    await runCommand(
      'bash',
      ['scripts/setup.sh', '--skip-install', '--skip-sandbox', '--skip-network', '--env-file', envFile, '--sqlite-path', sqlitePath],
      isolatedEnv({ SQLITE_PATH: sqlitePath })
    );

    if (!existsSync(envFile)) {
      throw new Error(`Expected setup to create env file at ${envFile}`);
    }

    if (!existsSync(sqlitePath)) {
      throw new Error(`Expected setup migration to create sqlite db at ${sqlitePath}`);
    }

    await runCommand('npm', ['run', 'build'], isolatedEnv({
      SQLITE_PATH: sqlitePath,
      NEXT_PUBLIC_STORAGE_BACKEND: 'sqlite',
      ASSET_STORAGE: 'local',
      ASSET_LOCAL_PATH: resolve(tempRoot, 'data/generations'),
      NODE_ENV: 'production',
    }));

    server = spawn('npm', ['run', 'start', '--', '-p', String(port)], {
      env: isolatedEnv({
        SQLITE_PATH: sqlitePath,
        NEXT_PUBLIC_STORAGE_BACKEND: 'sqlite',
        ASSET_STORAGE: 'local',
        ASSET_LOCAL_PATH: resolve(tempRoot, 'data/generations'),
        NODE_ENV: 'production',
      }),
      stdio: 'inherit',
      shell: false,
    });

    const baseUrl = `http://localhost:${port}`;
    const healthResponse = await waitForHealth(baseUrl);
    const configResponse = await fetch(`${baseUrl}/api/config`);

    if (!configResponse.ok) {
      throw new Error(`Install smoke /api/config returned ${configResponse.status}`);
    }

    return {
      name: 'oss-install-smoke',
      status: 'pass',
      details: {
        envFile,
        sqlitePath,
        healthStatus: healthResponse.status,
        configStatus: configResponse.status,
      },
    };
  } catch (error) {
    return {
      name: 'oss-install-smoke',
      status: 'fail',
      error: error instanceof Error ? error.message : String(error),
      details: { envFile, sqlitePath },
    };
  } finally {
    if (server && !server.killed) {
      server.kill('SIGTERM');
      await delay(2_000);
      if (!server.killed) {
        server.kill('SIGKILL');
      }
    }
  }
}

async function runUpgradeSmoke(): Promise<SmokeStepResult> {
  const ts = Date.now();
  const tempRoot = resolve(`.tmp/oss-release-smoke/upgrade-${ts}`);
  const sqlitePath = resolve(tempRoot, 'data/koda-upgrade-smoke.db');

  mkdirSync(dirname(sqlitePath), { recursive: true });

  try {
    const legacyDb = new Database(sqlitePath);
    legacyDb.exec(`
      CREATE TABLE IF NOT EXISTS canvases (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        nodes TEXT,
        edges TEXT,
        thumbnail TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);

    legacyDb.prepare(`
      INSERT INTO canvases (id, name, nodes, edges, thumbnail, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('legacy_canvas_1', 'Legacy Canvas', '[]', '[]', '/legacy-thumb.png', Date.now(), Date.now());
    legacyDb.close();

    await runCommand('npm', ['run', 'db:migrate'], isolatedEnv({
      SQLITE_PATH: sqlitePath,
    }));

    const upgradedDb = new Database(sqlitePath, { readonly: true });
    const columns = upgradedDb
      .prepare("PRAGMA table_info('canvases')")
      .all() as Array<{ name: string }>;
    const row = upgradedDb
      .prepare('SELECT thumbnail_url as thumbnailUrl, thumbnail_status as thumbnailStatus FROM canvases WHERE id = ?')
      .get('legacy_canvas_1') as { thumbnailUrl?: string; thumbnailStatus?: string } | undefined;
    upgradedDb.close();

    const columnSet = new Set(columns.map((column) => column.name));
    if (!columnSet.has('thumbnail_url') || !columnSet.has('thumbnail_status')) {
      throw new Error('Migration did not add thumbnail_url/thumbnail_status columns');
    }

    if (!row || row.thumbnailUrl !== '/legacy-thumb.png' || row.thumbnailStatus !== 'ready') {
      throw new Error(`Backfill check failed (thumbnailUrl=${row?.thumbnailUrl}, thumbnailStatus=${row?.thumbnailStatus})`);
    }

    return {
      name: 'oss-upgrade-smoke',
      status: 'pass',
      details: {
        sqlitePath,
        verifiedColumns: ['thumbnail_url', 'thumbnail_status'],
      },
    };
  } catch (error) {
    return {
      name: 'oss-upgrade-smoke',
      status: 'fail',
      error: error instanceof Error ? error.message : String(error),
      details: { sqlitePath },
    };
  }
}

async function run() {
  const { mode, reportPath, port } = parseArgs();
  const report: OSSReleaseSmokeReport = {
    mode,
    startedAt: new Date().toISOString(),
    steps: [],
  };

  const shouldRunInstall = mode === 'install' || mode === 'all';
  const shouldRunUpgrade = mode === 'upgrade' || mode === 'all';

  try {
    if (shouldRunInstall) {
      report.steps.push(await runInstallSmoke(port));
    }

    if (shouldRunUpgrade) {
      report.steps.push(await runUpgradeSmoke());
    }

    const failed = report.steps.find((step) => step.status === 'fail');
    if (failed) {
      throw new Error(`Smoke step failed: ${failed.name}`);
    }
  } finally {
    report.completedAt = new Date().toISOString();
    const outputPath = resolve(reportPath);
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, JSON.stringify(report, null, 2));
    console.log(`[oss-release-smoke] report -> ${outputPath}`);
  }
}

run().catch((error) => {
  console.error('[oss-release-smoke] failed:', error);
  process.exit(1);
});
