/**
 * Local Snapshot Provider
 *
 * Buffer-based: stores tar.gz Buffers on the host filesystem.
 * No Docker/sandbox awareness — callers handle export/import.
 *
 * Versioned snapshot layout:
 *   {basePath}/{nodeId}/{versionId}/code.tar.gz   — versioned snapshot
 *   {basePath}/{nodeId}/{versionId}/metadata.json
 *   {basePath}/{nodeId}/latest/code.tar.gz        — symlink/copy of most recent
 *   {basePath}/{nodeId}/latest/metadata.json
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { SnapshotProvider, SnapshotMetadata } from './snapshot-provider';

const LATEST = 'latest';

export class LocalSnapshotProvider implements SnapshotProvider {
  constructor(private basePath: string) {}

  private versionDir(nodeId: string, versionId: string): string {
    return path.join(this.basePath, nodeId, versionId);
  }

  private tarPath(nodeId: string, versionId: string): string {
    return path.join(this.versionDir(nodeId, versionId), 'code.tar.gz');
  }

  private metadataPath(nodeId: string, versionId: string): string {
    return path.join(this.versionDir(nodeId, versionId), 'metadata.json');
  }

  async save(nodeId: string, versionId: string, data: Buffer, metadata?: Partial<SnapshotMetadata>): Promise<void> {
    // Write to versioned directory
    const dir = this.versionDir(nodeId, versionId);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(this.tarPath(nodeId, versionId), data);

    // Write metadata
    const meta: SnapshotMetadata = {
      nodeId,
      versionId,
      engine: (metadata?.engine || 'remotion') as 'remotion' | 'theatre',
      createdAt: new Date().toISOString(),
      fileCount: metadata?.fileCount || 0,
      sizeBytes: data.length,
    };
    await fs.writeFile(this.metadataPath(nodeId, versionId), JSON.stringify(meta, null, 2));

    // Also copy to "latest" for quick restore
    const latestDir = this.versionDir(nodeId, LATEST);
    await fs.mkdir(latestDir, { recursive: true });
    await fs.writeFile(this.tarPath(nodeId, LATEST), data);
    await fs.writeFile(this.metadataPath(nodeId, LATEST), JSON.stringify(meta, null, 2));

    console.log(`[LocalSnapshot] Saved snapshot for ${nodeId}/${versionId} (${Math.round(data.length / 1024)}KB)`);
  }

  async load(nodeId: string, versionId?: string): Promise<Buffer | null> {
    const vid = versionId || LATEST;
    const tarFile = this.tarPath(nodeId, vid);
    try {
      return await fs.readFile(tarFile);
    } catch {
      return null;
    }
  }

  async exists(nodeId: string, versionId?: string): Promise<boolean> {
    const vid = versionId || LATEST;
    try {
      await fs.access(this.tarPath(nodeId, vid));
      return true;
    } catch {
      return false;
    }
  }

  async delete(nodeId: string, versionId?: string): Promise<void> {
    if (versionId) {
      // Delete specific version
      const dir = this.versionDir(nodeId, versionId);
      try {
        await fs.rm(dir, { recursive: true, force: true });
        console.log(`[LocalSnapshot] Deleted snapshot ${nodeId}/${versionId}`);
      } catch {
        // Already deleted or never existed
      }
    } else {
      // Delete all versions for this node
      const dir = path.join(this.basePath, nodeId);
      try {
        await fs.rm(dir, { recursive: true, force: true });
        console.log(`[LocalSnapshot] Deleted all snapshots for ${nodeId}`);
      } catch {
        // Already deleted or never existed
      }
    }
  }

  async getMetadata(nodeId: string, versionId?: string): Promise<SnapshotMetadata | null> {
    const vid = versionId || LATEST;
    try {
      const raw = await fs.readFile(this.metadataPath(nodeId, vid), 'utf-8');
      return JSON.parse(raw) as SnapshotMetadata;
    } catch {
      return null;
    }
  }
}
