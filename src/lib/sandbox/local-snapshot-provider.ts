/**
 * Local Snapshot Provider
 *
 * Stores sandbox code snapshots on the host filesystem using:
 * - `docker exec` to tar code inside the container
 * - `docker cp` to copy the tarball to the host
 * - Reverse for restore
 *
 * Snapshot layout:
 *   {basePath}/{nodeId}/code.tar.gz   — tarball of /app/src + /app/public/media
 *   {basePath}/{nodeId}/metadata.json  — snapshot metadata
 */

import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { SnapshotProvider, SnapshotMetadata } from './snapshot-provider';
import { dockerProvider } from './docker-provider';

const DEFAULT_TIMEOUT = 30_000;

function execCommand(
  command: string,
  args: string[],
  timeout = DEFAULT_TIMEOUT
): Promise<{ success: boolean; stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    execFile(command, args, { timeout, maxBuffer: 50 * 1024 * 1024 }, (error, stdout, stderr) => {
      const exitCode = error && 'code' in error ? (error.code as number) : 0;
      resolve({
        success: !error || exitCode === 0,
        stdout: stdout?.toString() || '',
        stderr: stderr?.toString() || '',
        exitCode: typeof exitCode === 'number' ? exitCode : 1,
      });
    });
  });
}

export class LocalSnapshotProvider implements SnapshotProvider {
  constructor(private basePath: string) {}

  private snapshotDir(nodeId: string): string {
    return path.join(this.basePath, nodeId);
  }

  private tarPath(nodeId: string): string {
    return path.join(this.snapshotDir(nodeId), 'code.tar.gz');
  }

  private metadataPath(nodeId: string): string {
    return path.join(this.snapshotDir(nodeId), 'metadata.json');
  }

  async save(nodeId: string, sandboxId: string, metadata?: Partial<SnapshotMetadata>): Promise<void> {
    const dir = this.snapshotDir(nodeId);
    await fs.mkdir(dir, { recursive: true });

    // Step 1: Create tarball inside the container
    // Include src/ (code) and public/media/ (user uploads) if they exist
    const tarResult = await dockerProvider.runCommand(
      sandboxId,
      'cd /app && tar czf /tmp/snapshot.tar.gz --ignore-failed-read src/ public/media/ 2>/dev/null; echo "TAR_EXIT=$?"',
      { timeout: 15_000 }
    );

    if (!tarResult.success && !tarResult.stdout.includes('TAR_EXIT=0')) {
      // Even if tar warns about missing dirs, we proceed if it created the file
      const checkTar = await dockerProvider.runCommand(
        sandboxId,
        'test -f /tmp/snapshot.tar.gz && echo "OK" || echo "MISSING"',
        { timeout: 5_000 }
      );
      if (checkTar.stdout.trim() !== 'OK') {
        throw new Error(`Snapshot tar failed: ${tarResult.stderr}`);
      }
    }

    // Step 2: Copy tarball from container to host
    const cpResult = await execCommand('docker', [
      'cp',
      `${sandboxId}:/tmp/snapshot.tar.gz`,
      this.tarPath(nodeId),
    ], 30_000);

    if (!cpResult.success) {
      throw new Error(`docker cp failed: ${cpResult.stderr}`);
    }

    // Step 3: Write metadata
    const tarStat = await fs.stat(this.tarPath(nodeId)).catch(() => null);
    const meta: SnapshotMetadata = {
      nodeId,
      engine: (metadata?.engine || 'remotion') as 'remotion' | 'theatre',
      createdAt: new Date().toISOString(),
      fileCount: metadata?.fileCount || 0,
      sizeBytes: tarStat?.size || 0,
    };
    await fs.writeFile(this.metadataPath(nodeId), JSON.stringify(meta, null, 2));

    // Step 4: Cleanup temp file inside container (non-critical)
    dockerProvider.runCommand(sandboxId, 'rm -f /tmp/snapshot.tar.gz', { timeout: 5_000 }).catch(() => {});

    console.log(`[LocalSnapshot] Saved snapshot for ${nodeId} (${Math.round((meta.sizeBytes || 0) / 1024)}KB)`);
  }

  async restore(nodeId: string, sandboxId: string): Promise<boolean> {
    const tarFile = this.tarPath(nodeId);

    // Check if snapshot exists on disk
    try {
      await fs.access(tarFile);
    } catch {
      return false;
    }

    // Step 1: Copy tarball into the container
    const cpResult = await execCommand('docker', [
      'cp',
      tarFile,
      `${sandboxId}:/tmp/snapshot.tar.gz`,
    ], 30_000);

    if (!cpResult.success) {
      console.warn(`[LocalSnapshot] docker cp into container failed: ${cpResult.stderr}`);
      return false;
    }

    // Step 2: Extract tarball over the template code
    const extractResult = await dockerProvider.runCommand(
      sandboxId,
      'cd /app && tar xzf /tmp/snapshot.tar.gz 2>&1',
      { timeout: 15_000 }
    );

    if (!extractResult.success) {
      console.warn(`[LocalSnapshot] tar extract failed: ${extractResult.stderr}`);
      return false;
    }

    // Step 3: Cleanup temp file (non-critical)
    dockerProvider.runCommand(sandboxId, 'rm -f /tmp/snapshot.tar.gz', { timeout: 5_000 }).catch(() => {});

    console.log(`[LocalSnapshot] Restored snapshot for ${nodeId} into sandbox ${sandboxId}`);
    return true;
  }

  async exists(nodeId: string): Promise<boolean> {
    try {
      await fs.access(this.tarPath(nodeId));
      return true;
    } catch {
      return false;
    }
  }

  async delete(nodeId: string): Promise<void> {
    const dir = this.snapshotDir(nodeId);
    try {
      await fs.rm(dir, { recursive: true, force: true });
      console.log(`[LocalSnapshot] Deleted snapshot for ${nodeId}`);
    } catch {
      // Already deleted or never existed
    }
  }

  async getMetadata(nodeId: string): Promise<SnapshotMetadata | null> {
    try {
      const raw = await fs.readFile(this.metadataPath(nodeId), 'utf-8');
      return JSON.parse(raw) as SnapshotMetadata;
    } catch {
      return null;
    }
  }
}
