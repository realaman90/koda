/**
 * Sandbox Factory
 *
 * Returns the appropriate SandboxProvider based on SANDBOX_PROVIDER env var.
 * Default: Docker. Alternative: E2B (cloud sandboxes).
 *
 * Also re-exports convenience helpers (getSandboxInstance, readSandboxFileRaw)
 * so callers import from a single location.
 */

import type { SandboxProvider, SandboxInstance } from './types';

let provider: SandboxProvider | null = null;

export function getSandboxProvider(): SandboxProvider {
  if (!provider) {
    const type = process.env.SANDBOX_PROVIDER || 'docker';
    if (type === 'e2b') {
      // Lazy import to avoid loading E2B SDK when not needed
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { e2bProvider } = require('./e2b-provider');
      provider = e2bProvider as SandboxProvider;
    } else {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { dockerProvider } = require('./docker-provider');
      provider = dockerProvider as SandboxProvider;
    }
  }
  return provider!;
}

/**
 * Convenience: look up a sandbox instance by ID via the active provider.
 */
export function getSandboxInstance(sandboxId: string): Promise<SandboxInstance | undefined> {
  return getSandboxProvider().getInstance(sandboxId);
}

/**
 * Convenience: read raw binary data from a sandbox file via the active provider.
 */
export function readSandboxFileRaw(sandboxId: string, filePath: string): Promise<Buffer> {
  return getSandboxProvider().readFileRaw(sandboxId, filePath);
}
