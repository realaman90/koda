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

import type { StorageProvider, StorageProviderType } from './types';
import { getLocalStorageProvider } from './local-storage-provider';

/**
 * Current storage provider type
 * Can be changed to support different backends
 */
let currentProviderType: StorageProviderType = 'localStorage';

/**
 * Get the current storage provider
 * Returns the appropriate provider based on current configuration
 */
export function getStorageProvider(): StorageProvider {
  switch (currentProviderType) {
    case 'localStorage':
      return getLocalStorageProvider();
    // Future providers:
    // case 'libSQL':
    //   return getLibSQLProvider();
    // case 'supabase':
    //   return getSupabaseProvider();
    default:
      return getLocalStorageProvider();
  }
}

/**
 * Set the storage provider type
 * Useful for switching between local and cloud storage
 */
export function setStorageProviderType(type: StorageProviderType): void {
  currentProviderType = type;
}

/**
 * Get the current storage provider type
 */
export function getStorageProviderType(): StorageProviderType {
  return currentProviderType;
}
