/**
 * Snapshot Factory
 *
 * Returns the appropriate SnapshotProvider based on environment.
 * Currently only LocalSnapshotProvider; future: R2SnapshotProvider for cloud.
 */

import { LocalSnapshotProvider } from './local-snapshot-provider';
import type { SnapshotProvider } from './snapshot-provider';

let instance: SnapshotProvider | null = null;

export function getSnapshotProvider(): SnapshotProvider {
  if (!instance) {
    const basePath = process.env.SNAPSHOT_PATH || './data/snapshots';
    instance = new LocalSnapshotProvider(basePath);
  }
  return instance;
}
