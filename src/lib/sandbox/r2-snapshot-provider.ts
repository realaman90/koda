/**
 * R2 Snapshot Provider
 *
 * Buffer-based: stores tar.gz Buffers in Cloudflare R2.
 * No Docker/sandbox awareness — callers handle export/import.
 *
 * R2 key layout:
 *   snapshots/{nodeId}/{versionId}/code.tar.gz
 *   snapshots/{nodeId}/{versionId}/metadata.json
 *   snapshots/{nodeId}/latest/code.tar.gz        — copy of most recent
 *   snapshots/{nodeId}/latest/metadata.json
 *
 * Reuses R2 env vars: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME
 */

import type { SnapshotProvider, SnapshotMetadata } from './snapshot-provider';
import { signRequest, type S3Config } from '../assets/s3-signing';

const LATEST = 'latest';
const PREFIX = 'snapshots';

function getR2Config(): S3Config {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET_NAME;

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error(
      'Missing R2 configuration. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME.'
    );
  }

  const defaultEndpoint = `https://${accountId}.r2.cloudflarestorage.com`;
  const endpoint = process.env.R2_ENDPOINT || defaultEndpoint;

  return {
    type: 'r2',
    accountId,
    accessKeyId,
    secretAccessKey,
    bucket,
    region: 'auto',
    endpoint,
  };
}

export class R2SnapshotProvider implements SnapshotProvider {
  private config: S3Config;

  constructor() {
    this.config = getR2Config();
  }

  private tarKey(nodeId: string, versionId: string): string {
    return `${PREFIX}/${nodeId}/${versionId}/code.tar.gz`;
  }

  private metadataKey(nodeId: string, versionId: string): string {
    return `${PREFIX}/${nodeId}/${versionId}/metadata.json`;
  }

  private async putObject(key: string, body: Buffer, contentType: string): Promise<void> {
    const data = new Uint8Array(body);
    const { url, headers } = await signRequest(this.config, 'PUT', key, data, contentType);
    const response = await fetch(url, {
      method: 'PUT',
      headers,
      body: Buffer.from(data),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`R2 PUT failed for ${key}: ${response.status} ${errorText}`);
    }
  }

  private async getObject(key: string): Promise<Buffer | null> {
    const { url, headers } = await signRequest(this.config, 'GET', key);
    const response = await fetch(url, { method: 'GET', headers });
    if (response.status === 404) return null;
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`R2 GET failed for ${key}: ${response.status} ${errorText}`);
    }
    return Buffer.from(await response.arrayBuffer());
  }

  private async headObject(key: string): Promise<boolean> {
    const { url, headers } = await signRequest(this.config, 'HEAD', key);
    const response = await fetch(url, { method: 'HEAD', headers });
    return response.ok;
  }

  private async deleteObject(key: string): Promise<void> {
    const { url, headers } = await signRequest(this.config, 'DELETE', key);
    await fetch(url, { method: 'DELETE', headers });
    // DELETE returns 204 even if key doesn't exist — no error check needed
  }

  async save(nodeId: string, versionId: string, data: Buffer, metadata?: Partial<SnapshotMetadata>): Promise<void> {
    const meta: SnapshotMetadata = {
      nodeId,
      versionId,
      engine: (metadata?.engine || 'remotion') as 'remotion' | 'theatre',
      createdAt: new Date().toISOString(),
      fileCount: metadata?.fileCount || 0,
      sizeBytes: data.length,
    };
    const metaJson = JSON.stringify(meta, null, 2);

    // Upload versioned snapshot + metadata
    await Promise.all([
      this.putObject(this.tarKey(nodeId, versionId), data, 'application/gzip'),
      this.putObject(this.metadataKey(nodeId, versionId), Buffer.from(metaJson), 'application/json'),
    ]);

    // Also copy to "latest" for quick restore
    await Promise.all([
      this.putObject(this.tarKey(nodeId, LATEST), data, 'application/gzip'),
      this.putObject(this.metadataKey(nodeId, LATEST), Buffer.from(metaJson), 'application/json'),
    ]);

    console.log(`[R2Snapshot] Saved snapshot for ${nodeId}/${versionId} (${Math.round(data.length / 1024)}KB)`);
  }

  async load(nodeId: string, versionId?: string): Promise<Buffer | null> {
    const vid = versionId || LATEST;
    return this.getObject(this.tarKey(nodeId, vid));
  }

  async exists(nodeId: string, versionId?: string): Promise<boolean> {
    const vid = versionId || LATEST;
    return this.headObject(this.tarKey(nodeId, vid));
  }

  async delete(nodeId: string, versionId?: string): Promise<void> {
    if (versionId) {
      // Delete specific version
      await Promise.all([
        this.deleteObject(this.tarKey(nodeId, versionId)),
        this.deleteObject(this.metadataKey(nodeId, versionId)),
      ]);
      console.log(`[R2Snapshot] Deleted snapshot ${nodeId}/${versionId}`);
    } else {
      // Delete latest — we can't list objects with pure S3 signing easily,
      // so delete known keys (latest). Individual versions remain until
      // explicitly deleted or managed via R2 lifecycle rules.
      await Promise.all([
        this.deleteObject(this.tarKey(nodeId, LATEST)),
        this.deleteObject(this.metadataKey(nodeId, LATEST)),
      ]);
      console.log(`[R2Snapshot] Deleted latest snapshot for ${nodeId} (versioned copies may remain)`);
    }
  }

  async getMetadata(nodeId: string, versionId?: string): Promise<SnapshotMetadata | null> {
    const vid = versionId || LATEST;
    const data = await this.getObject(this.metadataKey(nodeId, vid));
    if (!data) return null;
    try {
      return JSON.parse(data.toString('utf-8')) as SnapshotMetadata;
    } catch {
      return null;
    }
  }
}
