/**
 * Snapshot Provider Interface
 *
 * Abstracts the storage backend for sandbox code snapshots.
 * After each successful render, the sandbox code is snapshotted.
 * When a container dies (idle timeout, restart), the snapshot is
 * restored into a new container transparently.
 *
 * Current implementation: LocalSnapshotProvider (disk via docker cp + tar)
 * Future: R2SnapshotProvider for cloud persistence
 */

export interface SnapshotMetadata {
  nodeId: string;
  engine: 'remotion' | 'theatre';
  createdAt: string;
  fileCount: number;
  sizeBytes: number;
}

export interface SnapshotProvider {
  /** Save a snapshot of sandbox code to storage */
  save(nodeId: string, sandboxId: string, metadata?: Partial<SnapshotMetadata>): Promise<void>;

  /** Restore a snapshot into a sandbox container. Returns true if restored. */
  restore(nodeId: string, sandboxId: string): Promise<boolean>;

  /** Check if a snapshot exists for this node */
  exists(nodeId: string): Promise<boolean>;

  /** Delete a snapshot */
  delete(nodeId: string): Promise<void>;

  /** Get snapshot metadata (null if not found) */
  getMetadata(nodeId: string): Promise<SnapshotMetadata | null>;
}
