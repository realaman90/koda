/**
 * Docker Sandbox Provider
 *
 * Manages Docker containers for animation code execution.
 * Each sandbox is an isolated container with Node.js, Chromium, FFmpeg,
 * and Theatre.js dependencies pre-installed.
 *
 * Uses child_process.execFile (not exec) to avoid shell injection.
 */

import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import type { SandboxProvider, SandboxInstance, SandboxFile, CommandResult } from './types';

const SANDBOX_IMAGE = process.env.SANDBOX_IMAGE || 'koda/animation-sandbox';
const CONTAINER_PREFIX = 'koda-sandbox-';
const DOCKER_NETWORK = 'koda-sandbox-net';
const DEFAULT_TIMEOUT = 30_000; // 30 seconds
const MAX_TIMEOUT = 300_000; // 5 minutes
const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes idle timeout
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // Check every 5 minutes

/** In-memory tracking of active sandboxes */
const activeSandboxes = new Map<string, SandboxInstance>();

/** Track whether the Docker network has been created this process */
let networkEnsured = false;

/**
 * Ensure the Docker bridge network exists.
 * Containers on this network can talk to each other by container name.
 */
async function ensureNetwork(): Promise<void> {
  if (networkEnsured) return;
  try {
    await execAsync('docker', ['network', 'inspect', DOCKER_NETWORK], 5_000);
  } catch {
    // Network doesn't exist — create it
    await execAsync('docker', ['network', 'create', DOCKER_NETWORK], 10_000);
  }
  networkEnsured = true;
}

/** Port pool for sandbox dev servers (range: 15173–15272, up to 100 concurrent sandboxes) */
const PORT_RANGE_START = 15_173;
const PORT_RANGE_END = 15_272;
const usedPorts = new Set<number>();

function allocatePort(): number {
  for (let port = PORT_RANGE_START; port <= PORT_RANGE_END; port++) {
    if (!usedPorts.has(port)) {
      usedPorts.add(port);
      return port;
    }
  }
  throw new Error(`No available ports in range ${PORT_RANGE_START}–${PORT_RANGE_END}`);
}

function releasePort(port: number): void {
  usedPorts.delete(port);
}

/** Validate that a sandbox file path is safe (no directory traversal or absolute paths) */
function validatePath(path: string): void {
  if (path.includes('..') || path.startsWith('/') || path.includes('\0')) {
    throw new Error(`Invalid sandbox path: ${path}`);
  }
}

/**
 * Execute a command and return stdout/stderr
 */
function execAsync(
  command: string,
  args: string[],
  timeout = DEFAULT_TIMEOUT
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(command, args, { timeout, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error && !('code' in error)) {
        reject(error);
        return;
      }
      resolve({ stdout: stdout.toString(), stderr: stderr.toString() });
    });
  });
}

/**
 * Execute a command and return a full CommandResult (including exit code)
 */
function execCommand(
  command: string,
  args: string[],
  timeout = DEFAULT_TIMEOUT
): Promise<CommandResult> {
  return new Promise((resolve) => {
    execFile(command, args, { timeout, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      const exitCode = error && 'code' in error ? (error.code as number) : 0;
      resolve({
        success: exitCode === 0,
        stdout: stdout?.toString() || '',
        stderr: stderr?.toString() || '',
        exitCode,
      });
    });
  });
}

export const dockerProvider: SandboxProvider = {
  /**
   * Create a new sandbox container
   */
  async create(projectId: string): Promise<SandboxInstance> {
    const sandboxId = `${CONTAINER_PREFIX}${projectId}-${randomUUID().slice(0, 8)}`;
    const hostPort = allocatePort();

    const now = new Date().toISOString();
    const instance: SandboxInstance = {
      id: sandboxId,
      projectId,
      status: 'creating',
      createdAt: now,
      lastActivityAt: now,
      port: hostPort,
    };
    activeSandboxes.set(sandboxId, instance);

    try {
      // Ensure the bridge network exists
      await ensureNetwork();

      // Run the container in detached mode with a working directory
      const { stdout } = await execAsync('docker', [
        'run',
        '-d',
        '--name', sandboxId,
        '--workdir', '/app',
        // Memory limit to prevent runaway processes
        '--memory', '2g',
        '--memory-swap', '2g',
        // CPU limit
        '--cpus', '2',
        // Bridge network — allows package installs and proxy access
        '--network', DOCKER_NETWORK,
        // Expose the Vite dev server on a host port for proxying
        '-p', `${hostPort}:5173`,
        SANDBOX_IMAGE,
        // Keep container running
        'tail', '-f', '/dev/null',
      ]);

      instance.containerId = stdout.trim();
      instance.status = 'ready';
      activeSandboxes.set(sandboxId, instance);

      // Copy template files into the container
      await execAsync('docker', [
        'exec', sandboxId,
        'sh', '-c', 'if [ -d /template ]; then cp -r /template/* /app/; fi',
      ]);

      return instance;
    } catch (error) {
      instance.status = 'error';
      activeSandboxes.set(sandboxId, instance);
      throw new Error(
        `Failed to create sandbox: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  },

  /**
   * Destroy a sandbox container
   */
  async destroy(sandboxId: string): Promise<void> {
    const sandbox = activeSandboxes.get(sandboxId);
    try {
      await execAsync('docker', ['rm', '-f', sandboxId], 10_000);
    } catch {
      // Container may already be removed — ignore
    }
    // Release the port back to the pool
    if (sandbox?.port) {
      releasePort(sandbox.port);
    }
    activeSandboxes.delete(sandboxId);
  },

  /**
   * Write a file to the sandbox
   */
  async writeFile(sandboxId: string, path: string, content: string): Promise<void> {
    validatePath(path);
    touchActivity(sandboxId);

    // Ensure parent directory exists
    const dir = path.substring(0, path.lastIndexOf('/'));
    if (dir) {
      await execAsync('docker', ['exec', sandboxId, 'mkdir', '-p', `/app/${dir}`]);
    }

    // Write content via stdin pipe using docker exec
    await new Promise<void>((resolve, reject) => {
      const proc = execFile(
        'docker',
        ['exec', '-i', sandboxId, 'sh', '-c', `cat > /app/${path}`],
        { timeout: DEFAULT_TIMEOUT },
        (error) => {
          if (error) reject(error);
          else resolve();
        }
      );
      proc.stdin?.write(content);
      proc.stdin?.end();
    });
  },

  /**
   * Read a file from the sandbox
   */
  async readFile(sandboxId: string, path: string): Promise<string> {
    validatePath(path);
    touchActivity(sandboxId);
    const { stdout } = await execAsync('docker', ['exec', sandboxId, 'cat', `/app/${path}`]);
    return stdout;
  },

  /**
   * List files in a directory
   */
  async listFiles(sandboxId: string, path: string, recursive = false): Promise<SandboxFile[]> {
    validatePath(path);

    // Use sh -c to properly group the find expression with parentheses
    const findExpr = recursive
      ? `find /app/${path} \\( -type f -o -type d \\)`
      : `find /app/${path} -maxdepth 1 \\( -type f -o -type d \\)`;
    const findArgs = ['exec', sandboxId, 'sh', '-c', findExpr];

    const { stdout } = await execAsync('docker', findArgs);

    const appPrefix = '/app/';
    return stdout
      .split('\n')
      .filter(Boolean)
      .map((line): SandboxFile => {
        const relativePath = line.startsWith(appPrefix) ? line.slice(appPrefix.length) : line;
        // Directories end with / from find, but we detect by checking if it's the queried path
        const isDir = line.endsWith('/') || line === `/app/${path}`;
        return {
          path: relativePath,
          type: isDir ? 'directory' : 'file',
        };
      })
      .filter((f) => f.path !== path && f.path !== ''); // filter out the root query path
  },

  /**
   * Run a command in the sandbox
   */
  async runCommand(
    sandboxId: string,
    command: string,
    options?: { background?: boolean; timeout?: number }
  ): Promise<CommandResult> {
    touchActivity(sandboxId);
    const timeout = Math.min(options?.timeout || DEFAULT_TIMEOUT, MAX_TIMEOUT);
    const sandbox = activeSandboxes.get(sandboxId);

    if (sandbox) {
      sandbox.status = 'busy';
      activeSandboxes.set(sandboxId, sandbox);
    }

    try {
      let result: CommandResult;

      if (options?.background) {
        // Run in background: use nohup and redirect output
        result = await execCommand(
          'docker',
          ['exec', '-d', sandboxId, 'sh', '-c', command],
          timeout
        );
      } else {
        result = await execCommand(
          'docker',
          ['exec', sandboxId, 'sh', '-c', command],
          timeout
        );
      }

      if (sandbox) {
        sandbox.status = 'ready';
        activeSandboxes.set(sandboxId, sandbox);
      }

      return result;
    } catch (error) {
      if (sandbox) {
        sandbox.status = 'ready';
        activeSandboxes.set(sandboxId, sandbox);
      }
      return {
        success: false,
        stdout: '',
        stderr: error instanceof Error ? error.message : String(error),
        exitCode: 1,
      };
    }
  },

  /**
   * Get sandbox status
   */
  async getStatus(sandboxId: string): Promise<SandboxInstance | null> {
    const cached = activeSandboxes.get(sandboxId);

    try {
      const { stdout } = await execAsync(
        'docker',
        ['inspect', '--format', '{{.State.Status}}', sandboxId],
        5_000
      );

      const dockerStatus = stdout.trim();
      if (cached) {
        cached.status = dockerStatus === 'running' ? 'ready' : 'error';
        return cached;
      }

      const now = new Date().toISOString();
      return {
        id: sandboxId,
        projectId: 'unknown',
        status: dockerStatus === 'running' ? 'ready' : 'error',
        createdAt: now,
        lastActivityAt: now,
      };
    } catch {
      // Container doesn't exist
      if (cached) {
        activeSandboxes.delete(sandboxId);
      }
      return null;
    }
  },
};

/**
 * Update the last activity timestamp for a sandbox.
 */
function touchActivity(sandboxId: string): void {
  const sandbox = activeSandboxes.get(sandboxId);
  if (sandbox) {
    sandbox.lastActivityAt = new Date().toISOString();
  }
}

/**
 * Periodically destroy idle sandboxes to prevent resource leaks.
 * Runs every CLEANUP_INTERVAL_MS, destroys sandboxes idle longer than IDLE_TIMEOUT_MS.
 */
function startIdleCleanup(): void {
  setInterval(async () => {
    const now = Date.now();
    const toDestroy: string[] = [];

    for (const [sandboxId, instance] of activeSandboxes) {
      const lastActivity = new Date(instance.lastActivityAt).getTime();
      if (now - lastActivity > IDLE_TIMEOUT_MS && instance.status !== 'busy') {
        toDestroy.push(sandboxId);
      }
    }

    for (const sandboxId of toDestroy) {
      console.log(`[sandbox] Destroying idle sandbox: ${sandboxId}`);
      try {
        await dockerProvider.destroy(sandboxId);
      } catch (err) {
        console.error(`[sandbox] Failed to destroy idle sandbox ${sandboxId}:`, err);
      }
    }
  }, CLEANUP_INTERVAL_MS).unref(); // unref() so the interval doesn't prevent process exit
}

// Start the idle cleanup timer
startIdleCleanup();

/**
 * Look up a sandbox instance by ID. Used by API routes for proxying/file serving.
 */
export function getSandboxInstance(sandboxId: string): SandboxInstance | undefined {
  return activeSandboxes.get(sandboxId);
}

/**
 * Read raw binary data from a file in the sandbox.
 * Returns a Buffer (used for serving videos/images).
 */
export function readSandboxFileRaw(
  sandboxId: string,
  filePath: string
): Promise<Buffer> {
  validatePath(filePath);
  return new Promise((resolve, reject) => {
    execFile(
      'docker',
      ['exec', sandboxId, 'cat', `/app/${filePath}`],
      { encoding: 'buffer' as unknown as string, maxBuffer: 100 * 1024 * 1024, timeout: 30_000 },
      (error, stdout) => {
        if (error) {
          reject(new Error(`Failed to read file: ${error.message}`));
          return;
        }
        resolve(Buffer.isBuffer(stdout) ? stdout : Buffer.from(stdout));
      }
    );
  });
}
