/**
 * Asset Storage Module
 * 
 * Provides a unified interface for storing generated assets (images, videos, audio).
 * Supports local filesystem, Cloudflare R2, and AWS S3 backends.
 * 
 * NOTE: The actual storage providers (LocalAssetProvider, S3AssetProvider) are
 * SERVER-ONLY and should be imported directly in API routes:
 * 
 *   import { getLocalAssetProvider } from '@/lib/assets/local-provider'
 *   import { getS3AssetProvider } from '@/lib/assets/s3-provider'
 */

export type {
  AssetType,
  AssetStorageType,
  AssetMetadata,
  StoredAsset,
  SaveAssetOptions,
  AssetStorageProvider,
} from './types';

export {
  generateAssetId,
  getMimeType,
  getExtensionFromMime,
  getExtensionFromUrl,
} from './types';

// NOTE: Do NOT export providers here - they use Node.js APIs
// Import them directly in API routes instead

import type { AssetStorageType } from './types';

/**
 * Get the configured asset storage type from environment
 */
export function getAssetStorageType(): AssetStorageType {
  const type = process.env.ASSET_STORAGE as AssetStorageType;
  
  if (type === 'r2' || type === 's3') {
    return type;
  }
  
  // Default to local storage
  return 'local';
}

/**
 * Check if asset storage is configured for cloud
 */
export function isCloudAssetStorage(): boolean {
  const type = getAssetStorageType();
  return type === 'r2' || type === 's3';
}

/**
 * Check if local asset storage is being used
 */
export function isLocalAssetStorage(): boolean {
  return getAssetStorageType() === 'local';
}

/**
 * Check if asset storage is explicitly configured
 * (vs using default fal.ai URLs)
 */
export function isAssetStorageConfigured(): boolean {
  return !!process.env.ASSET_STORAGE;
}
