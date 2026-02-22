import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { spawn, type ChildProcess } from 'node:child_process';

interface SmokeReport {
  profile: 'oss' | 'hosted';
  baseUrl: string;
  startedAt: string;
  completedAt?: string;
  checks: {
    startup: 'pass' | 'fail';
    health: 'pass' | 'fail';
    apiConfig: 'pass' | 'fail';
  };
  details: {
    healthStatus?: number;
    configStatus?: number;
    distribution?: string;
    source?: string;
    error?: string;
  };
}

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (name: string, fallback?: string) => {
    const index = args.indexOf(name);
    if (index === -1) return fallback;
    return args[index + 1] ?? fallback;
  };

  const profile = get('--profile', 'oss');
  if (profile !== 'oss' && profile !== 'hosted') {
    throw new Error(`Invalid --profile value: ${profile}`);
  }

  const port = Number(get('--port', '4100'));
  if (Number.isNaN(port) || port <= 0) {
    throw new Error(`Invalid --port value: ${port}`);
  }

  const reportPath = get('--report', `reports/ci-parity/${profile}.json`)!;

  return { profile, port, reportPath } as const;
}

async function waitForHealth(baseUrl: string, timeoutMs = 60_000): Promise<Response> {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) {
        return response;
      }
    } catch {
      // server not booted yet
    }

    await delay(1_000);
  }

  throw new Error(`Timed out waiting for health endpoint after ${timeoutMs}ms`);
}

async function run() {
  const { profile, port, reportPath } = parseArgs();
  const baseUrl = `http://localhost:${port}`;
  const report: SmokeReport = {
    profile,
    baseUrl,
    startedAt: new Date().toISOString(),
    checks: {
      startup: 'fail',
      health: 'fail',
      apiConfig: 'fail',
    },
    details: {},
  };

  let server: ChildProcess | undefined;

  try {
    const standaloneServerPath = resolve('.next/standalone/server.js');
    const useStandaloneServer = existsSync(standaloneServerPath);

    server = useStandaloneServer
      ? spawn('node', [standaloneServerPath], {
          env: {
            ...process.env,
            NODE_ENV: 'production',
            PORT: String(port),
            HOSTNAME: 'localhost',
          },
          stdio: 'inherit',
          shell: false,
        })
      : spawn('npm', ['run', 'start', '--', '-p', String(port)], {
          env: {
            ...process.env,
            NODE_ENV: 'production',
          },
          stdio: 'inherit',
          shell: false,
        });

    server.on('exit', (code) => {
      if (code !== null && code !== 0) {
        console.error(`[smoke-profile] next start exited with code ${code}`);
      }
    });

    const healthResponse = await waitForHealth(baseUrl);
    report.checks.startup = 'pass';
    report.checks.health = 'pass';
    report.details.healthStatus = healthResponse.status;

    const healthJson = (await healthResponse.json()) as { distribution?: string; source?: string };
    report.details.distribution = healthJson.distribution;
    report.details.source = healthJson.source;

    if (healthJson.distribution !== profile) {
      throw new Error(
        `Distribution mismatch for ${profile}: health endpoint reported "${healthJson.distribution ?? 'unknown'}"`
      );
    }

    const configResponse = await fetch(`${baseUrl}/api/config`);
    report.details.configStatus = configResponse.status;

    if (!configResponse.ok) {
      throw new Error(`/api/config returned status ${configResponse.status}`);
    }

    report.checks.apiConfig = 'pass';
  } catch (error) {
    report.details.error = error instanceof Error ? error.message : String(error);
    throw error;
  } finally {
    if (server && !server.killed) {
      server.kill('SIGTERM');
      await delay(2_000);
      if (!server.killed) {
        server.kill('SIGKILL');
      }
    }

    report.completedAt = new Date().toISOString();
    const outputPath = resolve(reportPath);
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, JSON.stringify(report, null, 2));
    console.log(`[smoke-profile] wrote report -> ${outputPath}`);
  }
}

run().catch((error) => {
  console.error('[smoke-profile] failed:', error);
  process.exit(1);
});
