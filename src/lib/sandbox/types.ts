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

  /** Get sandbox status */
  getStatus(sandboxId: string): Promise<SandboxInstance | null>;
}
