/**
 * Configuration Utilities
 * 
 * Provides helpers for checking the current storage configuration
 * and displaying configuration status.
 * 
 * This module is safe to import from both client and server.
 */

import { getAssetStorageType, isAssetStorageConfigured } from '../assets';
import { getStorageProviderType } from '../storage';

// Import database config function (doesn't use Node.js APIs)
function getDatabaseConfig() {
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoToken = process.env.TURSO_AUTH_TOKEN;
  
  if (tursoUrl) {
    return {
      url: tursoUrl,
      authToken: tursoToken,
      type: 'turso' as const,
      isLocal: false,
      path: null as string | null,
    };
  }
  
  const sqlitePath = process.env.SQLITE_PATH || './data/koda.db';
  
  return {
    url: `file:${sqlitePath}`,
    authToken: undefined,
    type: 'local' as const,
    isLocal: true,
    path: sqlitePath,
  };
}

/**
 * Storage configuration summary
 */
export interface StorageConfig {
  // Canvas/Project Storage
  canvas: {
    type: 'localStorage' | 'sqlite';
    backend: 'browser' | 'local-file' | 'turso';
    location: string;
    isCloud: boolean;
  };
  // Asset Storage (images, videos, audio)
  assets: {
    type: 'fal-urls' | 'local' | 'r2' | 's3';
    location: string;
    isCloud: boolean;
    isConfigured: boolean;
  };
}

/**
 * Get the current storage configuration summary
 */
export function getStorageConfig(): StorageConfig {
  // Canvas storage config
  const canvasType = getStorageProviderType();
  let canvasBackend: StorageConfig['canvas']['backend'] = 'browser';
  let canvasLocation = 'Browser localStorage';
  let canvasIsCloud = false;

  if (canvasType === 'sqlite') {
    const dbConfig = getDatabaseConfig();
    if (dbConfig.type === 'turso') {
      canvasBackend = 'turso';
      canvasLocation = dbConfig.url.replace('libsql://', '');
      canvasIsCloud = true;
    } else {
      canvasBackend = 'local-file';
      canvasLocation = dbConfig.url.replace('file:', '');
      canvasIsCloud = false;
    }
  }

  // Asset storage config
  const assetType = getAssetStorageType();
  const assetConfigured = isAssetStorageConfigured();
  let assetLocation = 'fal.ai CDN (temporary URLs)';
  let assetIsCloud = true;

  if (!assetConfigured) {
    // Not configured - using fal.ai URLs directly
    assetLocation = 'fal.ai CDN (URLs may expire)';
    assetIsCloud = true;
  } else if (assetType === 'local') {
    assetLocation = process.env.ASSET_LOCAL_PATH || './data/generations';
    assetIsCloud = false;
  } else if (assetType === 'r2') {
    assetLocation = `R2: ${process.env.R2_BUCKET_NAME || 'not configured'}`;
    assetIsCloud = true;
  } else if (assetType === 's3') {
    assetLocation = `S3: ${process.env.S3_BUCKET_NAME || 'not configured'}`;
    assetIsCloud = true;
  }

  return {
    canvas: {
      type: canvasType,
      backend: canvasBackend,
      location: canvasLocation,
      isCloud: canvasIsCloud,
    },
    assets: {
      type: assetConfigured ? assetType : 'fal-urls',
      location: assetLocation,
      isCloud: assetIsCloud,
      isConfigured: assetConfigured,
    },
  };
}

/**
 * Check if running in full self-hosted mode (all local)
 */
export function isFullySelfHosted(): boolean {
  const config = getStorageConfig();
  return !config.canvas.isCloud && !config.assets.isCloud;
}

/**
 * Check if running in full cloud mode
 */
export function isFullyCloud(): boolean {
  const config = getStorageConfig();
  return config.canvas.isCloud && config.assets.isCloud && config.assets.isConfigured;
}

/**
 * Get a human-readable configuration summary
 */
export function getConfigSummary(): string {
  const config = getStorageConfig();
  
  const lines = [
    '📦 Storage Configuration:',
    '',
    `Canvas Data: ${config.canvas.type}`,
    `  └─ Backend: ${config.canvas.backend}`,
    `  └─ Location: ${config.canvas.location}`,
    '',
    `Assets: ${config.assets.type}`,
    `  └─ Location: ${config.assets.location}`,
    `  └─ Configured: ${config.assets.isConfigured ? 'Yes' : 'No (using fal.ai URLs)'}`,
  ];

  return lines.join('\n');
}
