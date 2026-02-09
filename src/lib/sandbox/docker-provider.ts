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

// Docker images for each animation framework
const SANDBOX_IMAGES = {
  theatre: process.env.SANDBOX_IMAGE_THEATRE || 'koda/animation-sandbox',
  remotion: process.env.SANDBOX_IMAGE_REMOTION || 'koda/remotion-sandbox',
} as const;
type SandboxTemplate = keyof typeof SANDBOX_IMAGES;
const CONTAINER_PREFIX = 'koda-sandbox-';
const DOCKER_NETWORK = 'koda-sandbox-net';
const DEFAULT_TIMEOUT = 30_000; // 30 seconds
const MAX_TIMEOUT = 300_000; // 5 minutes
const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes idle timeout
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // Check every 5 minutes

// Resource limits (configurable via env vars)
const SANDBOX_MEMORY = process.env.SANDBOX_MEMORY || '1g';
const SANDBOX_MEMORY_SWAP = process.env.SANDBOX_MEMORY_SWAP || SANDBOX_MEMORY;
const SANDBOX_CPUS = process.env.SANDBOX_CPUS || '2';

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
  // Use execCommand (not execAsync) because execAsync resolves even on
  // non-zero exit codes, so a try/catch would never detect a missing network.
  const inspect = await execCommand('docker', ['network', 'inspect', DOCKER_NETWORK], 5_000);
  if (!inspect.success) {
    // Network doesn't exist — create it
    const create = await execCommand('docker', ['network', 'create', DOCKER_NETWORK], 10_000);
    if (!create.success) {
      throw new Error(`Failed to create Docker network ${DOCKER_NETWORK}: ${create.stderr}`);
    }
  }
  networkEnsured = true;
}

/** Port pool for sandbox dev servers (range: 15173–15272, up to 100 concurrent sandboxes) */
const PORT_RANGE_START = 15_173;
const PORT_RANGE_END = 15_272;
const usedPorts = new Set<number>();

/**
 * Get ports actually in use by Docker containers.
 * This survives server restarts by checking real Docker state.
 */
async function getDockerUsedPorts(): Promise<Set<number>> {
  const ports = new Set<number>();
  try {
    // Get all koda-sandbox containers and their port mappings
    const result = await execCommand('docker', [
      'ps', '-a',
      '--filter', `name=${CONTAINER_PREFIX}`,
      '--format', '{{.Ports}}',
    ], 5_000);

    if (result.success && result.stdout) {
      // Parse port mappings like "0.0.0.0:15173->5173/tcp"
      const portMatches = result.stdout.matchAll(/0\.0\.0\.0:(\d+)->5173/g);
      for (const match of portMatches) {
        ports.add(parseInt(match[1], 10));
      }
    }
  } catch {
    // If Docker check fails, fall back to in-memory tracking
  }
  return ports;
}

async function allocatePort(): Promise<number> {
  // Get ports actually in use by Docker containers
  const dockerPorts = await getDockerUsedPorts();

  // Merge with in-memory tracking (belt and suspenders)
  for (const port of dockerPorts) {
    usedPorts.add(port);
  }

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

/**
 * Validate that a sandbox file path is safe (no directory traversal or null bytes).
 * Absolute paths are allowed — they refer to locations inside the Docker container.
 */
function validatePath(path: string): void {
  if (path.includes('..') || path.includes('\0')) {
    throw new Error(`Invalid sandbox path: ${path}`);
  }
}

/**
 * Resolve a path for use inside the container.
 * - Absolute paths (e.g. /tmp/vite.log, /app/src/App.tsx) are used as-is
 * - Relative paths (e.g. src/App.tsx) get prefixed with /app/
 * - Paths starting with /app/ are used as-is (already fully qualified)
 */
function resolveContainerPath(path: string): string {
  if (path.startsWith('/')) return path;
  return `/app/${path}`;
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

/**
 * Check if a container exists and is running.
 * Returns an object with status info.
 */
async function checkContainerStatus(sandboxId: string): Promise<{
  exists: boolean;
  running: boolean;
  status?: string;
}> {
  const result = await execCommand('docker', [
    'inspect',
    '--format',
    '{{.State.Status}}',
    sandboxId,
  ], 5_000);

  if (!result.success) {
    return { exists: false, running: false };
  }

  const status = result.stdout.trim();
  return {
    exists: true,
    running: status === 'running',
    status,
  };
}

/**
 * Ensure a container is running before performing operations.
 * If the container is in "created" state (failed to start), try to start it.
 * Throws a descriptive error if the container doesn't exist or can't be started.
 */
async function ensureContainerRunning(sandboxId: string): Promise<void> {
  let status = await checkContainerStatus(sandboxId);

  if (!status.exists) {
    throw new Error(
      `Sandbox "${sandboxId}" does not exist. ` +
      `Create a new sandbox with sandbox_create before writing files.`
    );
  }

  // If container exists but isn't running, try to start it
  if (!status.running && status.status === 'created') {
    console.log(`[Sandbox] Container ${sandboxId} is in "created" state, attempting to start...`);
    const startResult = await execCommand('docker', ['start', sandboxId], 10_000);
    if (startResult.success) {
      // Re-check status after starting
      status = await checkContainerStatus(sandboxId);
    } else {
      // Start failed - likely port conflict. Remove the broken container.
      console.log(`[Sandbox] Failed to start container ${sandboxId}: ${startResult.stderr}`);
      await execCommand('docker', ['rm', '-f', sandboxId], 5_000);
      activeSandboxes.delete(sandboxId);
      throw new Error(
        `Sandbox "${sandboxId}" failed to start (${startResult.stderr.trim() || 'unknown error'}). ` +
        `The container has been removed. Create a new sandbox with sandbox_create.`
      );
    }
  }

  // If container exited, try to restart it
  if (!status.running && status.status === 'exited') {
    console.log(`[Sandbox] Container ${sandboxId} has exited, attempting to restart...`);
    const restartResult = await execCommand('docker', ['restart', sandboxId], 15_000);
    if (restartResult.success) {
      status = await checkContainerStatus(sandboxId);
    }
  }

  if (!status.running) {
    throw new Error(
      `Sandbox "${sandboxId}" is not running (status: ${status.status}). ` +
      `The container may have stopped or been cleaned up. ` +
      `Create a new sandbox with sandbox_create to continue.`
    );
  }
}

export const dockerProvider: SandboxProvider = {
  /**
   * Create a new sandbox container
   *
   * @param projectId - Unique project identifier
   * @param template - Animation framework template ('theatre' or 'remotion')
   */
  async create(projectId: string, template: SandboxTemplate = 'theatre'): Promise<SandboxInstance> {
    const sandboxId = `${CONTAINER_PREFIX}${projectId}-${randomUUID().slice(0, 8)}`;
    const hostPort = await allocatePort();
    const image = SANDBOX_IMAGES[template];

    const now = new Date().toISOString();
    const instance: SandboxInstance = {
      id: sandboxId,
      projectId,
      status: 'creating',
      createdAt: now,
      lastActivityAt: now,
      port: hostPort,
      template,
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
        // Resource limits (configurable via SANDBOX_MEMORY, SANDBOX_MEMORY_SWAP, SANDBOX_CPUS)
        '--memory', SANDBOX_MEMORY,
        '--memory-swap', SANDBOX_MEMORY_SWAP,
        '--cpus', SANDBOX_CPUS,
        // Bridge network — allows package installs and proxy access
        '--network', DOCKER_NETWORK,
        // Expose the Vite dev server on a host port for proxying
        '-p', `${hostPort}:5173`,
        image,
        // Keep container running
        'tail', '-f', '/dev/null',
      ]);

      instance.containerId = stdout.trim();
      instance.status = 'ready';
      activeSandboxes.set(sandboxId, instance);

      // No need to copy template files - they're pre-installed in /app/ in the Docker image
      // with node_modules already present, so sandbox creation is instant.

      // Health check: verify bun/bunx are accessible
      const healthCheck = await execCommand(
        'docker',
        ['exec', sandboxId, 'sh', '-c', 'export PATH="/root/.bun/bin:/usr/local/bin:$PATH" && which bunx && bunx --version'],
        10_000
      );
      if (!healthCheck.success) {
        console.warn(`[DockerProvider] Health check: bunx not found in container ${sandboxId}. PATH check:`);
        const pathCheck = await execCommand('docker', ['exec', sandboxId, 'sh', '-c', 'echo "PATH=$PATH" && ls -la /root/.bun/bin/ 2>/dev/null || echo "BUN_DIR_MISSING"'], 5_000);
        console.warn(`[DockerProvider] ${pathCheck.stdout.trim()}`);
      } else {
        console.log(`[DockerProvider] Health check OK: ${healthCheck.stdout.trim()}`);
      }

      return instance;
    } catch (error) {
      // Clean up on failure
      instance.status = 'error';
      activeSandboxes.delete(sandboxId);
      releasePort(hostPort);

      // Try to remove any partially created container
      try {
        await execCommand('docker', ['rm', '-f', sandboxId], 5_000);
      } catch {
        // Ignore - container may not exist
      }

      const errorMsg = error instanceof Error ? error.message : String(error);

      // Check if it's a port conflict and provide helpful message
      if (errorMsg.includes('port is already allocated') || errorMsg.includes('address already in use')) {
        throw new Error(
          `Port ${hostPort} is already in use. This may be a stale container. ` +
          `Retrying sandbox creation should allocate a new port.`
        );
      }

      throw new Error(`Failed to create sandbox: ${errorMsg}`);
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

    // Check container is running before attempting write
    await ensureContainerRunning(sandboxId);

    touchActivity(sandboxId);

    const containerPath = resolveContainerPath(path);

    // Ensure parent directory exists
    const dir = containerPath.substring(0, containerPath.lastIndexOf('/'));
    if (dir) {
      await execAsync('docker', ['exec', sandboxId, 'mkdir', '-p', dir]);
    }

    // Write content via stdin pipe using docker exec
    await new Promise<void>((resolve, reject) => {
      const proc = execFile(
        'docker',
        ['exec', '-i', sandboxId, 'sh', '-c', `cat > ${containerPath}`],
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
    await ensureContainerRunning(sandboxId);
    touchActivity(sandboxId);
    const containerPath = resolveContainerPath(path);
    const { stdout } = await execAsync('docker', ['exec', sandboxId, 'cat', containerPath]);
    return stdout;
  },

  /**
   * List files in a directory
   */
  async listFiles(sandboxId: string, path: string, recursive = false): Promise<SandboxFile[]> {
    validatePath(path);
    await ensureContainerRunning(sandboxId);

    const containerPath = resolveContainerPath(path);

    // Use sh -c to properly group the find expression with parentheses
    const findExpr = recursive
      ? `find ${containerPath} \\( -type f -o -type d \\)`
      : `find ${containerPath} -maxdepth 1 \\( -type f -o -type d \\)`;
    const findArgs = ['exec', sandboxId, 'sh', '-c', findExpr];

    const { stdout } = await execAsync('docker', findArgs);

    const appPrefix = '/app/';
    return stdout
      .split('\n')
      .filter(Boolean)
      .map((line): SandboxFile => {
        const relativePath = line.startsWith(appPrefix) ? line.slice(appPrefix.length) : line;
        // Directories end with / from find, but we detect by checking if it's the queried path
        const isDir = line.endsWith('/') || line === containerPath;
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
    await ensureContainerRunning(sandboxId);
    touchActivity(sandboxId);
    const timeout = Math.min(options?.timeout || DEFAULT_TIMEOUT, MAX_TIMEOUT);
    const sandbox = activeSandboxes.get(sandboxId);

    if (sandbox) {
      sandbox.status = 'busy';
      activeSandboxes.set(sandboxId, sandbox);
    }

    try {
      // Ensure bun/bunx are on PATH for all commands.
      // Belt-and-suspenders: some Docker/sh configurations don't inherit
      // ENV variables from the image, causing "bunx: command not found" (exit 127).
      const wrappedCommand = `export PATH="/root/.bun/bin:/usr/local/bin:$PATH" && ${command}`;
      let result: CommandResult;

      if (options?.background) {
        // Run in background: use nohup and redirect output
        result = await execCommand(
          'docker',
          ['exec', '-d', sandboxId, 'sh', '-c', wrappedCommand],
          timeout
        );
      } else {
        result = await execCommand(
          'docker',
          ['exec', sandboxId, 'sh', '-c', wrappedCommand],
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
   * Upload media (image/video) to the sandbox by downloading from a URL.
   * Uses curl inside the container to fetch the file directly.
   */
  async uploadMedia(
    sandboxId: string,
    mediaUrl: string,
    destPath: string
  ): Promise<{ success: boolean; path: string; size?: number; error?: string }> {
    validatePath(destPath);
    touchActivity(sandboxId);

    const containerPath = resolveContainerPath(destPath);

    // Ensure parent directory exists
    const dir = containerPath.substring(0, containerPath.lastIndexOf('/'));
    if (dir) {
      await execAsync('docker', ['exec', sandboxId, 'mkdir', '-p', dir]);
    }

    // Use curl to download the file directly into the container
    // -L follows redirects, -s is silent, -o specifies output file
    const result = await execCommand(
      'docker',
      ['exec', sandboxId, 'curl', '-L', '-s', '-o', containerPath, mediaUrl],
      60_000 // 60 second timeout for large files
    );

    if (!result.success) {
      return {
        success: false,
        path: destPath,
        error: `Failed to download media: ${result.stderr}`,
      };
    }

    // Get file size
    const sizeResult = await execCommand(
      'docker',
      ['exec', sandboxId, 'stat', '-c', '%s', containerPath],
      5_000
    );
    const size = parseInt(sizeResult.stdout.trim(), 10) || undefined;

    return {
      success: true,
      path: destPath,
      size,
    };
  },

  /**
   * Write binary data (images, videos) to the sandbox.
   * Pipes raw Buffer through stdin to avoid shell escaping issues.
   */
  async writeBinary(sandboxId: string, path: string, data: Buffer): Promise<void> {
    validatePath(path);
    await ensureContainerRunning(sandboxId);
    touchActivity(sandboxId);

    const containerPath = resolveContainerPath(path);

    // Ensure parent directory exists
    const dir = containerPath.substring(0, containerPath.lastIndexOf('/'));
    if (dir) {
      await execAsync('docker', ['exec', sandboxId, 'mkdir', '-p', dir]);
    }

    // Pipe binary data through stdin using cat
    await new Promise<void>((resolve, reject) => {
      const proc = execFile(
        'docker',
        ['exec', '-i', sandboxId, 'sh', '-c', `cat > ${containerPath}`],
        { timeout: 60_000, maxBuffer: 100 * 1024 * 1024 },
        (error) => {
          if (error) reject(error);
          else resolve();
        }
      );
      proc.stdin?.write(data);
      proc.stdin?.end();
    });
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

  /**
   * Export a snapshot of sandbox code as a tar.gz Buffer.
   * Tars src/ and public/media/ inside the container, then copies to host.
   */
  async exportSnapshot(sandboxId: string, paths?: string[]): Promise<Buffer> {
    const tarPaths = paths?.join(' ') || 'src/ public/media/';
    // Create tarball inside the container
    const tarResult = await execCommand(
      'docker',
      ['exec', sandboxId, 'sh', '-c', `cd /app && tar czf /tmp/snapshot.tar.gz --ignore-failed-read ${tarPaths} 2>/dev/null; echo "TAR_EXIT=$?"`],
      15_000
    );

    if (!tarResult.success && !tarResult.stdout.includes('TAR_EXIT=0')) {
      const checkTar = await execCommand(
        'docker',
        ['exec', sandboxId, 'sh', '-c', 'test -f /tmp/snapshot.tar.gz && echo "OK" || echo "MISSING"'],
        5_000
      );
      if (checkTar.stdout.trim() !== 'OK') {
        throw new Error(`Snapshot tar failed: ${tarResult.stderr}`);
      }
    }

    // Read the tarball as binary from the container
    const buffer = await new Promise<Buffer>((resolve, reject) => {
      execFile(
        'docker',
        ['exec', sandboxId, 'cat', '/tmp/snapshot.tar.gz'],
        { encoding: 'buffer' as unknown as string, maxBuffer: 100 * 1024 * 1024, timeout: 30_000 },
        (error, stdout) => {
          if (error) {
            reject(new Error(`Failed to read snapshot: ${error.message}`));
            return;
          }
          resolve(Buffer.isBuffer(stdout) ? stdout : Buffer.from(stdout));
        }
      );
    });

    // Cleanup temp file (non-critical)
    execCommand('docker', ['exec', sandboxId, 'rm', '-f', '/tmp/snapshot.tar.gz'], 5_000).catch(() => {});

    return buffer;
  },

  /**
   * Import a snapshot (tar.gz Buffer) into a sandbox.
   */
  async importSnapshot(sandboxId: string, data: Buffer): Promise<boolean> {
    // Pipe the tar.gz into the container and extract
    try {
      await new Promise<void>((resolve, reject) => {
        const proc = execFile(
          'docker',
          ['exec', '-i', sandboxId, 'sh', '-c', 'cat > /tmp/snapshot.tar.gz'],
          { timeout: 30_000, maxBuffer: 100 * 1024 * 1024 },
          (error) => {
            if (error) reject(error);
            else resolve();
          }
        );
        proc.stdin?.write(data);
        proc.stdin?.end();
      });

      // Extract over the template code
      const extractResult = await execCommand(
        'docker',
        ['exec', sandboxId, 'sh', '-c', 'cd /app && tar xzf /tmp/snapshot.tar.gz 2>&1'],
        15_000
      );

      // Cleanup temp file (non-critical)
      execCommand('docker', ['exec', sandboxId, 'rm', '-f', '/tmp/snapshot.tar.gz'], 5_000).catch(() => {});

      if (!extractResult.success) {
        console.warn(`[DockerProvider] importSnapshot extract failed: ${extractResult.stderr}`);
        return false;
      }

      return true;
    } catch (err) {
      console.warn(`[DockerProvider] importSnapshot failed:`, err);
      return false;
    }
  },

  /**
   * Read raw binary data from a file in the sandbox.
   */
  async readFileRaw(sandboxId: string, path: string): Promise<Buffer> {
    validatePath(path);
    const containerPath = resolveContainerPath(path);
    return new Promise((resolve, reject) => {
      execFile(
        'docker',
        ['exec', sandboxId, 'cat', containerPath],
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
  },

  /**
   * Look up a sandbox instance by ID.
   * Falls back to Docker inspect + port detection if the in-memory map is empty.
   */
  async getInstance(sandboxId: string): Promise<SandboxInstance | undefined> {
    const cached = activeSandboxes.get(sandboxId);
    if (cached) return cached;

    try {
      const { stdout } = await execAsync(
        'docker',
        ['inspect', '--format', '{{.State.Status}}||{{(index (index .NetworkSettings.Ports "5173/tcp") 0).HostPort}}', sandboxId],
        5_000
      );
      const [status, portStr] = stdout.trim().split('||');
      if (status !== 'running') return undefined;

      const port = parseInt(portStr, 10);
      if (isNaN(port)) return undefined;

      const now = new Date().toISOString();
      const recovered: SandboxInstance = {
        id: sandboxId,
        projectId: 'recovered',
        status: 'ready',
        createdAt: now,
        lastActivityAt: now,
        port,
      };
      activeSandboxes.set(sandboxId, recovered);
      usedPorts.add(port);
      return recovered;
    } catch {
      return undefined;
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
 * Thin wrapper — delegates to dockerProvider.getInstance().
 * Kept for backward compatibility with existing imports.
 */
export function getSandboxInstance(sandboxId: string): Promise<SandboxInstance | undefined> {
  return dockerProvider.getInstance(sandboxId);
}

/**
 * Thin wrapper — delegates to dockerProvider.readFileRaw().
 * Kept for backward compatibility with existing imports.
 */
export function readSandboxFileRaw(sandboxId: string, filePath: string): Promise<Buffer> {
  return dockerProvider.readFileRaw(sandboxId, filePath);
}
