/**
 * Sandbox Types
 *
 * Interfaces for the sandbox provider abstraction.
 * Currently backed by Docker, but designed to swap in E2B or other providers.
 */

export type SandboxStatus = 'creating' | 'ready' | 'busy' | 'destroyed' | 'error';
export type SandboxTemplate = 'theatre' | 'remotion';

export interface SandboxInstance {
  id: string;
  projectId: string;
  status: SandboxStatus;
  containerId?: string;
  createdAt: string;
  lastActivityAt: string;
  port?: number;
  template?: SandboxTemplate;
  /** For E2B: full proxy URL (e.g. https://xyz.e2b.dev:5173). When set, proxy route uses this instead of localhost:port. */
  proxyBaseUrl?: string;
}

export interface SandboxFile {
  path: string;
  type: 'file' | 'directory';
  size?: number;
}

export interface CommandResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface SandboxProvider {
  /** Create a new sandbox for a project */
  create(projectId: string, template?: SandboxTemplate): Promise<SandboxInstance>;

  /** Destroy a sandbox */
  destroy(sandboxId: string): Promise<void>;

  /** Write a file to the sandbox */
  writeFile(sandboxId: string, path: string, content: string): Promise<void>;

  /** Read a file from the sandbox */
  readFile(sandboxId: string, path: string): Promise<string>;

  /** List files in a directory */
  listFiles(sandboxId: string, path: string, recursive?: boolean): Promise<SandboxFile[]>;

  /** Run a command in the sandbox */
  runCommand(sandboxId: string, command: string, options?: { background?: boolean; timeout?: number }): Promise<CommandResult>;

  /** Upload media (image/video) from a URL to the sandbox */
  uploadMedia(sandboxId: string, mediaUrl: string, destPath: string): Promise<{ success: boolean; path: string; size?: number; error?: string }>;

  /** Write binary data (images, videos) to the sandbox */
  writeBinary(sandboxId: string, path: string, data: Buffer): Promise<void>;

  /** Get sandbox status */
  getStatus(sandboxId: string): Promise<SandboxInstance | null>;

  /** Export a snapshot of sandbox code as a tar.gz Buffer */
  exportSnapshot(sandboxId: string, paths?: string[]): Promise<Buffer>;

  /** Import a snapshot (tar.gz Buffer) into a sandbox */
  importSnapshot(sandboxId: string, data: Buffer): Promise<boolean>;

  /** Read raw binary data from a file in the sandbox */
  readFileRaw(sandboxId: string, path: string): Promise<Buffer>;

  /** Look up a sandbox instance by ID (includes recovery from lost in-memory state) */
  getInstance(sandboxId: string): Promise<SandboxInstance | undefined>;
}
