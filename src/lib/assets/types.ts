/**
 * Asset Storage Types
 * 
 * Defines the interface for storing generated images and videos.
 * Supports local filesystem, Cloudflare R2, and AWS S3.
 */

/**
 * Asset type identifier
 */
export type AssetType = 'image' | 'video' | 'audio';

/**
 * Asset storage backend type
 */
export type AssetStorageType = 'local' | 'r2' | 's3';

/**
 * Metadata stored with each asset
 */
export interface AssetMetadata {
  /** Original filename if available */
  filename?: string;
  /** MIME type (e.g., 'image/png', 'video/mp4') */
  mimeType: string;
  /** File size in bytes */
  sizeBytes?: number;
  /** Associated canvas ID */
  canvasId?: string;
  /** Associated node ID */
  nodeId?: string;
  /** Model used for generation */
  model?: string;
  /** Original prompt */
  prompt?: string;
  /** Any additional metadata */
  extra?: Record<string, unknown>;
}

/**
 * Stored asset record
 */
export interface StoredAsset {
  /** Unique asset ID */
  id: string;
  /** Asset type */
  type: AssetType;
  /** Public URL to access the asset */
  url: string;
  /** Storage key/path (internal use) */
  key: string;
  /** Asset metadata */
  metadata: AssetMetadata;
  /** Creation timestamp */
  createdAt: number;
}

/**
 * Options for saving an asset
 */
export interface SaveAssetOptions {
  /** Asset type */
  type: AssetType;
  /** File extension (without dot, e.g., 'png', 'mp4') */
  extension: string;
  /** Asset metadata */
  metadata: AssetMetadata;
  /** Custom asset ID (auto-generated if not provided) */
  id?: string;
}

/**
 * Asset Storage Provider Interface
 * 
 * All asset storage backends must implement this interface.
 */
export interface AssetStorageProvider {
  /**
   * Save an asset from a remote URL
   * Downloads the file and stores it in the configured backend
   */
  saveFromUrl(remoteUrl: string, options: SaveAssetOptions): Promise<StoredAsset>;

  /**
   * Save an asset from a Buffer
   */
  saveFromBuffer(buffer: Buffer, options: SaveAssetOptions): Promise<StoredAsset>;

  /**
   * Get an asset by ID
   */
  get(id: string): Promise<StoredAsset | null>;

  /**
   * Delete an asset by ID
   */
  delete(id: string): Promise<void>;

  /**
   * Delete all assets for a canvas
   */
  deleteByCanvas(canvasId: string): Promise<number>;

  /**
   * List assets for a canvas
   */
  listByCanvas(canvasId: string): Promise<StoredAsset[]>;

  /**
   * Get the public URL for an asset
   */
  getUrl(id: string): string;
}

/**
 * Generate a unique asset ID
 */
export function generateAssetId(type: AssetType): string {
  const prefix = type === 'image' ? 'img' : type === 'video' ? 'vid' : 'aud';
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${timestamp}_${random}`;
}

/**
 * Get MIME type from file extension
 */
export function getMimeType(extension: string): string {
  const mimeTypes: Record<string, string> = {
    // Images
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'svg': 'image/svg+xml',
    // Videos
    'mp4': 'video/mp4',
    'webm': 'video/webm',
    'mov': 'video/quicktime',
    // Audio
    'mp3': 'audio/mpeg',
    'wav': 'audio/wav',
    'ogg': 'audio/ogg',
    'm4a': 'audio/mp4',
  };
  return mimeTypes[extension.toLowerCase()] || 'application/octet-stream';
}

/**
 * Get file extension from MIME type
 */
export function getExtensionFromMime(mimeType: string): string {
  const extensions: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'audio/mpeg': 'mp3',
    'audio/wav': 'wav',
  };
  return extensions[mimeType] || 'bin';
}

/**
 * Extract extension from URL
 */
export function getExtensionFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const match = pathname.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
    return match ? match[1].toLowerCase() : 'bin';
  } catch {
    return 'bin';
  }
}
