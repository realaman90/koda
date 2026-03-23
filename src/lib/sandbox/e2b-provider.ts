/**
 * E2B Cloud Sandbox Provider
 *
 * Alternative to DockerProvider — runs sandboxes on E2B's cloud infrastructure.
 * Same SandboxProvider interface, different backend.
 *
 * Requires:
 *   E2B_API_KEY       — E2B API key
 *   E2B_TEMPLATE_ID   — Custom template ID (built from templates/remotion-sandbox/Dockerfile)
 *
 * The template should be pre-built with:
 *   npx e2b template build --name koda-remotion --dockerfile templates/remotion-sandbox/Dockerfile
 */

import { Sandbox } from 'e2b';
import type { SandboxProvider, SandboxInstance, SandboxFile, CommandResult, SandboxTemplate } from './types';

const CONTAINER_PREFIX = 'koda-sandbox-';
const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_TIMEOUT_MS = 300_000;
const SANDBOX_TIMEOUT_MS = 60 * 60 * 1000; // 1 hour (E2B hobby limit)
const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

/** Runtime env setup prefix for E2B sandboxes.
 *  E2B's `envs` option on commands.run() doesn't reliably override PATH.
 *  Prepending export statements to each command is the most reliable approach. */
const ENV_PREFIX = 'export PATH="/home/user/.bun/bin:$PATH" && export REMOTION_CHROME_EXECUTABLE=/usr/bin/chromium && export PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium && ';

/** Map sandboxId → E2B Sandbox instance */
const activeSandboxes = new Map<string, { sandbox: Sandbox; instance: SandboxInstance }>();

function getTemplateId(template: SandboxTemplate = 'remotion'): string {
  if (template === 'remotion') {
    return process.env.E2B_TEMPLATE_ID_REMOTION || process.env.E2B_TEMPLATE_ID || 'base';
  }
  const theatreId = process.env.E2B_TEMPLATE_ID_THEATRE;
  if (!theatreId) {
    throw new Error(
      'Theatre.js is not available on E2B — no E2B_TEMPLATE_ID_THEATRE configured. ' +
      'Please use the Remotion engine instead, or set SANDBOX_PROVIDER=docker for Theatre.js support.'
    );
  }
  return theatreId;
}

function resolveContainerPath(path: string): string {
  if (path.startsWith('/')) return path;
  return `/app/${path}`;
}

function validatePath(path: string): void {
  if (path.includes('..') || path.includes('\0')) {
    throw new Error(`Invalid sandbox path: ${path}`);
  }
}

function touchActivity(sandboxId: string): void {
  const entry = activeSandboxes.get(sandboxId);
  if (entry) {
    entry.instance.lastActivityAt = new Date().toISOString();
  }
}

/**
 * Attempt to reconnect to an E2B sandbox that's alive but not in our in-memory map.
 * This happens when the server restarts — the in-memory map is lost, but E2B sandboxes
 * keep running in the cloud. Uses metadata filtering to find our sandbox by custom ID.
 */
async function attemptReconnect(sandboxId: string): Promise<{ sandbox: Sandbox; instance: SandboxInstance } | null> {
  try {
    // Search E2B for running sandboxes with matching custom sandboxId in metadata
    const paginator = Sandbox.list({
      query: {
        metadata: { sandboxId },
        state: ['running'],
      },
    });

    const results = await paginator.nextItems();
    if (results.length === 0) return null;

    const match = results[0];
    console.log(`[E2BProvider] Reconnecting to sandbox ${sandboxId} (e2b: ${match.sandboxId})`);

    const sandbox = await Sandbox.connect(match.sandboxId);

    const now = new Date().toISOString();
    const instance: SandboxInstance = {
      id: sandboxId,
      projectId: match.metadata?.projectId || 'unknown',
      status: 'ready',
      containerId: match.sandboxId,
      createdAt: match.startedAt?.toISOString() || now,
      lastActivityAt: now,
    };

    // Restore the proxy URL
    const host = sandbox.getHost(5173);
    instance.proxyBaseUrl = `https://${host}`;

    // Store back in memory so subsequent tool calls find it
    activeSandboxes.set(sandboxId, { sandbox, instance });

    console.log(`[E2BProvider] Successfully reconnected to ${sandboxId}`);
    return { sandbox, instance };
  } catch (err) {
    console.warn(`[E2BProvider] Failed to reconnect to sandbox ${sandboxId}:`, err);
    return null;
  }
}

export const e2bProvider: SandboxProvider = {
  async create(projectId: string, template: SandboxTemplate = 'remotion'): Promise<SandboxInstance> {
    const templateId = getTemplateId(template);
    const sandboxId = `${CONTAINER_PREFIX}${projectId}-${Math.random().toString(36).slice(2, 10)}`;

    const now = new Date().toISOString();
    const instance: SandboxInstance = {
      id: sandboxId,
      projectId,
      status: 'creating',
      createdAt: now,
      lastActivityAt: now,
      template,
    };

    try {
      const sandbox = await Sandbox.create(templateId, {
        timeoutMs: SANDBOX_TIMEOUT_MS,
        metadata: { projectId, sandboxId },
      });

      // Get the proxy URL for port 5173 (Vite dev server / Remotion Studio)
      const host = sandbox.getHost(5173);
      instance.proxyBaseUrl = `https://${host}`;
      instance.containerId = sandbox.sandboxId; // E2B's internal ID
      instance.id = sandboxId; // Keep our own ID for consistency
      instance.status = 'ready';

      activeSandboxes.set(sandboxId, { sandbox, instance });

      return instance;
    } catch (error) {
      instance.status = 'error';
      const errorMsg = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to create E2B sandbox: ${errorMsg}`);
    }
  },

  async destroy(sandboxId: string): Promise<void> {
    let entry = activeSandboxes.get(sandboxId);

    // If not in memory, try to reconnect so we can kill it
    if (!entry) {
      const recovered = await attemptReconnect(sandboxId);
      if (recovered) entry = recovered;
    }

    if (entry) {
      try {
        await entry.sandbox.kill();
      } catch {
        // Already killed
      }
      activeSandboxes.delete(sandboxId);
    }
  },

  async writeFile(sandboxId: string, path: string, content: string): Promise<void> {
    validatePath(path);
    const entry = activeSandboxes.get(sandboxId);
    if (!entry) throw new Error(`Sandbox "${sandboxId}" not found. Create a new sandbox first.`);
    touchActivity(sandboxId);

    const containerPath = resolveContainerPath(path);
    await entry.sandbox.files.write(containerPath, content);
  },

  async readFile(sandboxId: string, path: string): Promise<string> {
    validatePath(path);
    const entry = activeSandboxes.get(sandboxId);
    if (!entry) throw new Error(`Sandbox "${sandboxId}" not found.`);
    touchActivity(sandboxId);

    const containerPath = resolveContainerPath(path);
    return await entry.sandbox.files.read(containerPath, { format: 'text' });
  },

  async listFiles(sandboxId: string, path: string, recursive = false): Promise<SandboxFile[]> {
    validatePath(path);
    const entry = activeSandboxes.get(sandboxId);
    if (!entry) throw new Error(`Sandbox "${sandboxId}" not found.`);

    const containerPath = resolveContainerPath(path);

    if (recursive) {
      // E2B doesn't have native recursive listing — use find command
      const result = await entry.sandbox.commands.run(
        `find ${containerPath} \\( -type f -o -type d \\)`,
        { timeoutMs: DEFAULT_TIMEOUT_MS }
      );
      const appPrefix = '/app/';
      return result.stdout
        .split('\n')
        .filter(Boolean)
        .map((line): SandboxFile => {
          const relativePath = line.startsWith(appPrefix) ? line.slice(appPrefix.length) : line;
          return {
            path: relativePath,
            type: line.endsWith('/') || line === containerPath ? 'directory' : 'file',
          };
        })
        .filter((f) => f.path !== path && f.path !== '');
    }

    const entries = await entry.sandbox.files.list(containerPath);
    const appPrefix = '/app/';
    return entries.map((e): SandboxFile => {
      const relativePath = e.path.startsWith(appPrefix) ? e.path.slice(appPrefix.length) : e.path;
      return {
        path: relativePath,
        type: e.type === 'dir' ? 'directory' : 'file',
        size: 'size' in e ? (e as { size: number }).size : undefined,
      };
    });
  },

  async runCommand(
    sandboxId: string,
    command: string,
    options?: { background?: boolean; timeout?: number }
  ): Promise<CommandResult> {
    const entry = activeSandboxes.get(sandboxId);
    if (!entry) throw new Error(`Sandbox "${sandboxId}" not found.`);
    touchActivity(sandboxId);

    const timeout = Math.min(options?.timeout || DEFAULT_TIMEOUT_MS, MAX_TIMEOUT_MS);

    if (entry.instance) {
      entry.instance.status = 'busy';
    }

    try {
      const wrappedCommand = `${ENV_PREFIX}${command}`;

      if (options?.background) {
        await entry.sandbox.commands.run(wrappedCommand, {
          background: true,
          timeoutMs: timeout,
        });
        if (entry.instance) entry.instance.status = 'ready';
        return { success: true, stdout: '', stderr: '', exitCode: 0 };
      }

      const result = await entry.sandbox.commands.run(wrappedCommand, { timeoutMs: timeout });
      if (entry.instance) entry.instance.status = 'ready';

      return {
        success: result.exitCode === 0,
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
      };
    } catch (error: unknown) {
      if (entry.instance) entry.instance.status = 'ready';
      // E2B throws CommandExitError with a .result property on non-zero exit
      const e2bResult = (error as { result?: { stdout?: string; stderr?: string; exitCode?: number } }).result;
      if (e2bResult) {
        return {
          success: false,
          stdout: e2bResult.stdout || '',
          stderr: e2bResult.stderr || '',
          exitCode: e2bResult.exitCode ?? 1,
        };
      }
      return {
        success: false,
        stdout: '',
        stderr: error instanceof Error ? error.message : String(error),
        exitCode: 1,
      };
    }
  },

  async uploadMedia(
    sandboxId: string,
    mediaUrl: string,
    destPath: string
  ): Promise<{ success: boolean; path: string; size?: number; error?: string }> {
    validatePath(destPath);
    const entry = activeSandboxes.get(sandboxId);
    if (!entry) return { success: false, path: destPath, error: 'Sandbox not found' };
    touchActivity(sandboxId);

    const containerPath = resolveContainerPath(destPath);

    // Use curl inside the sandbox (same approach as Docker provider)
    const result = await entry.sandbox.commands.run(
      `curl -L -s -o ${containerPath} '${mediaUrl}'`,
      { timeoutMs: 60_000 }
    );

    if (result.exitCode !== 0) {
      return { success: false, path: destPath, error: `Download failed: ${result.stderr}` };
    }

    // Get file size
    const sizeResult = await entry.sandbox.commands.run(
      `stat -c '%s' ${containerPath}`,
      { timeoutMs: 5_000 }
    );
    const size = parseInt(sizeResult.stdout.trim(), 10) || undefined;

    return { success: true, path: destPath, size };
  },

  async writeBinary(sandboxId: string, path: string, data: Buffer): Promise<void> {
    validatePath(path);
    const entry = activeSandboxes.get(sandboxId);
    if (!entry) throw new Error(`Sandbox "${sandboxId}" not found.`);
    touchActivity(sandboxId);

    const containerPath = resolveContainerPath(path);
    // E2B files.write accepts ArrayBuffer
    await entry.sandbox.files.write(containerPath, data.buffer as ArrayBuffer);
  },

  async getStatus(sandboxId: string): Promise<SandboxInstance | null> {
    let entry = activeSandboxes.get(sandboxId);

    // If not in memory, try to reconnect to the running E2B sandbox
    if (!entry) {
      const recovered = await attemptReconnect(sandboxId);
      if (!recovered) return null;
      entry = recovered;
    }

    try {
      const running = await entry.sandbox.isRunning();
      entry.instance.status = running ? 'ready' : 'error';
      return entry.instance;
    } catch {
      activeSandboxes.delete(sandboxId);
      return null;
    }
  },

  async exportSnapshot(sandboxId: string, paths?: string[]): Promise<Buffer> {
    const entry = activeSandboxes.get(sandboxId);
    if (!entry) throw new Error(`Sandbox "${sandboxId}" not found.`);

    const tarPaths = paths?.join(' ') || 'src/ public/media/';

    // Create tarball inside the sandbox
    await entry.sandbox.commands.run(
      `cd /app && tar czf /tmp/snapshot.tar.gz --ignore-failed-read ${tarPaths} 2>/dev/null || true`,
      { timeoutMs: 15_000 }
    );

    // Read the tarball as bytes
    const data = await entry.sandbox.files.read('/tmp/snapshot.tar.gz', { format: 'bytes' });

    // Cleanup (non-critical)
    entry.sandbox.commands.run('rm -f /tmp/snapshot.tar.gz', { timeoutMs: 5_000 }).catch(() => {});

    return Buffer.from(data);
  },

  async importSnapshot(sandboxId: string, data: Buffer): Promise<boolean> {
    const entry = activeSandboxes.get(sandboxId);
    if (!entry) return false;

    try {
      // Write the tarball into the sandbox
      await entry.sandbox.files.write('/tmp/snapshot.tar.gz', data.buffer as ArrayBuffer);

      // Extract over the template code
      const result = await entry.sandbox.commands.run(
        'cd /app && tar xzf /tmp/snapshot.tar.gz 2>&1',
        { timeoutMs: 15_000 }
      );

      // Cleanup (non-critical)
      entry.sandbox.commands.run('rm -f /tmp/snapshot.tar.gz', { timeoutMs: 5_000 }).catch(() => {});

      if (result.exitCode !== 0) {
        console.warn(`[E2BProvider] importSnapshot extract failed: ${result.stderr}`);
        return false;
      }

      return true;
    } catch (err) {
      console.warn(`[E2BProvider] importSnapshot failed:`, err);
      return false;
    }
  },

  async readFileRaw(sandboxId: string, path: string): Promise<Buffer> {
    validatePath(path);
    const entry = activeSandboxes.get(sandboxId);
    if (!entry) throw new Error(`Sandbox "${sandboxId}" not found.`);

    const containerPath = resolveContainerPath(path);
    const data = await entry.sandbox.files.read(containerPath, { format: 'bytes' });
    return Buffer.from(data);
  },

  async getInstance(sandboxId: string): Promise<SandboxInstance | undefined> {
    const entry = activeSandboxes.get(sandboxId);
    if (entry) return entry.instance;

    // Try to reconnect to a running E2B sandbox via metadata lookup
    const recovered = await attemptReconnect(sandboxId);
    return recovered?.instance;
  },
};

/**
 * Periodically destroy idle E2B sandboxes.
 */
function startIdleCleanup(): void {
  setInterval(async () => {
    const now = Date.now();
    const toDestroy: string[] = [];

    for (const [sandboxId, entry] of activeSandboxes) {
      const lastActivity = new Date(entry.instance.lastActivityAt).getTime();
      if (now - lastActivity > IDLE_TIMEOUT_MS && entry.instance.status !== 'busy') {
        toDestroy.push(sandboxId);
      }
    }

    for (const sandboxId of toDestroy) {
      console.log(`[E2B] Destroying idle sandbox: ${sandboxId}`);
      try {
        await e2bProvider.destroy(sandboxId);
      } catch (err) {
        console.error(`[E2B] Failed to destroy idle sandbox ${sandboxId}:`, err);
      }
    }
  }, CLEANUP_INTERVAL_MS).unref();
}

startIdleCleanup();
