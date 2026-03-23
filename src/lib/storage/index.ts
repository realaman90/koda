export type {
  StoredCanvas,
  CanvasMetadata,
  StorageProvider,
  StorageProviderType,
} from './types';

export {
  generateCanvasId,
  createEmptyCanvas,
  canvasToMetadata,
} from './types';

export {
  LocalStorageProvider,
  getLocalStorageProvider,
} from './local-storage-provider';

// Sync service exports (client-safe)
export {
  subscribeSyncStatus,
  getSyncStatus,
  type SyncStatus,
} from './sync-service';

// NOTE: SQLiteStorageProvider is server-only
// Import it ONLY in API routes using:
// import { getSQLiteStorageProvider } from '@/lib/storage/sqlite-provider'

import type { StorageProvider, StorageProviderType } from './types';
import { getLocalStorageProvider } from './local-storage-provider';

/**
 * Get the configured storage backend from environment
 * Defaults to 'localStorage' for browser-only mode
 */
function getConfiguredBackend(): StorageProviderType {
  // Check environment variable
  const envBackend = process.env.NEXT_PUBLIC_STORAGE_BACKEND;
  
  if (envBackend === 'sqlite') {
    return 'sqlite';
  }
  
  // Default to localStorage
  return 'localStorage';
}

/**
 * Current storage provider type
 * Initialized from environment, can be changed at runtime
 */
let currentProviderType: StorageProviderType | null = null;

/**
 * Get the current storage provider (CLIENT-SIDE ONLY)
 * 
 * Always returns localStorage provider for use in React components.
 * This ensures the app works offline and has fast UI updates.
 * 
 * For server-side SQLite storage in API routes, import sqlite-provider directly:
 * import { getSQLiteStorageProvider } from '@/lib/storage/sqlite-provider'
 */
export function getStorageProvider(): StorageProvider {
  // Always use localStorage on client
  // SQLite operations happen via API routes
  return getLocalStorageProvider();
}

/**
 * Set the storage provider type at runtime
 */
export function setStorageProviderType(type: StorageProviderType): void {
  currentProviderType = type;
}

/**
 * Get the current storage provider type
 */
export function getStorageProviderType(): StorageProviderType {
  return currentProviderType ?? getConfiguredBackend();
}

/**
 * Check if SQLite backend is configured
 */
export function isSQLiteConfigured(): boolean {
  return getConfiguredBackend() === 'sqlite';
}
