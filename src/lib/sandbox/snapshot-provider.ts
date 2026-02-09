/**
 * Snapshot Provider Interface
 *
 * Abstracts the storage backend for sandbox code snapshots.
 * Providers are storage-only: they accept and return Buffers.
 * The caller (sandbox tools) handles extracting from / importing to sandboxes.
 *
 * Current implementations:
 * - LocalSnapshotProvider (disk-based, ./data/snapshots/)
 * - R2SnapshotProvider (Cloudflare R2 cloud storage)
 */

export interface SnapshotMetadata {
  nodeId: string;
  versionId?: string;
  engine: 'remotion' | 'theatre';
  createdAt: string;
  fileCount: number;
  sizeBytes: number;
}

export interface SnapshotProvider {
  /** Save a snapshot buffer to storage. versionId omitted = "latest" */
  save(nodeId: string, versionId: string, data: Buffer, metadata?: Partial<SnapshotMetadata>): Promise<void>;

  /** Load a snapshot buffer from storage. versionId omitted = latest. Returns null if not found. */
  load(nodeId: string, versionId?: string): Promise<Buffer | null>;

  /** Check if a snapshot exists. versionId omitted = any version */
  exists(nodeId: string, versionId?: string): Promise<boolean>;

  /** Delete a snapshot. versionId omitted = delete all versions for this node */
  delete(nodeId: string, versionId?: string): Promise<void>;

  /** Get snapshot metadata. versionId omitted = latest */
  getMetadata(nodeId: string, versionId?: string): Promise<SnapshotMetadata | null>;
}
