import type { AppNode, AppEdge } from '@/lib/types';

export type ThumbnailStatus = 'ready' | 'empty' | 'stale' | 'processing' | 'error';
export type ThumbnailErrorCode = 'UPLOAD_FAILED' | 'CAPTURE_FAILED' | 'UNSUPPORTED' | 'UNKNOWN';

/**
 * Canvas data structure for storage
 */
export interface StoredCanvas {
  id: string;
  name: string;
  nodes: AppNode[];
  edges: AppEdge[];

  /**
   * Legacy field kept for backward compatibility.
   * Prefer thumbnailUrl for all new writes.
   */
  thumbnail?: string;

  // Canonical preview metadata
  thumbnailUrl?: string;
  thumbnailStatus?: ThumbnailStatus;
  thumbnailUpdatedAt?: number;
  thumbnailVersion?: string;
  thumbnailErrorCode?: ThumbnailErrorCode;

  createdAt: number;
  updatedAt: number;
}

/**
 * Canvas metadata for listing (without full node/edge data)
 */
export interface CanvasMetadata {
  id: string;
  name: string;

  /**
   * Legacy field kept for UI compatibility during rollout.
   */
  thumbnail?: string;

  thumbnailUrl?: string;
  thumbnailStatus: ThumbnailStatus;
  thumbnailUpdatedAt?: number;
  thumbnailVersion?: string;
  thumbnailErrorCode?: ThumbnailErrorCode;

  createdAt: number;
  updatedAt: number;
  nodeCount: number;
}

/**
 * Storage provider interface - all storage backends must implement this
 */
export interface StorageProvider {
  /**
   * List all canvases (metadata only for performance)
   */
  listCanvases(): Promise<CanvasMetadata[]>;

  /**
   * Get a single canvas by ID with full data
   */
  getCanvas(id: string): Promise<StoredCanvas | null>;

  /**
   * Save or update a canvas
   */
  saveCanvas(canvas: StoredCanvas): Promise<void>;

  /**
   * Delete a canvas by ID
   */
  deleteCanvas(id: string): Promise<void>;

  /**
   * Check if a canvas exists
   */
  canvasExists(id: string): Promise<boolean>;

  /**
   * Optional sync method for cloud providers
   */
  sync?(): Promise<void>;
}

/**
 * Storage provider type identifier
 */
export type StorageProviderType = 'localStorage' | 'sqlite';

/**
 * Generate a unique canvas ID
 */
export function generateCanvasId(): string {
  return `canvas_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Create a new canvas with default values
 */
export function createEmptyCanvas(name: string = 'Untitled Canvas'): StoredCanvas {
  const now = Date.now();
  return {
    id: generateCanvasId(),
    name,
    nodes: [],
    edges: [],
    thumbnailStatus: 'empty',
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Normalize legacy/partial canvas objects into the canonical shape.
 */
export function normalizeStoredCanvas(canvas: StoredCanvas): StoredCanvas {
  const thumbnailUrl = canvas.thumbnailUrl ?? canvas.thumbnail;
  const thumbnailStatus = canvas.thumbnailStatus ?? (thumbnailUrl ? 'ready' : 'empty');

  return {
    ...canvas,
    thumbnail: canvas.thumbnail ?? thumbnailUrl,
    thumbnailUrl,
    thumbnailStatus,
  };
}

/**
 * Convert full canvas to metadata (for listing)
 */
export function canvasToMetadata(canvas: StoredCanvas): CanvasMetadata {
  const normalized = normalizeStoredCanvas(canvas);

  return {
    id: normalized.id,
    name: normalized.name,
    thumbnail: normalized.thumbnail,
    thumbnailUrl: normalized.thumbnailUrl,
    thumbnailStatus: normalized.thumbnailStatus ?? 'empty',
    thumbnailUpdatedAt: normalized.thumbnailUpdatedAt,
    thumbnailVersion: normalized.thumbnailVersion,
    thumbnailErrorCode: normalized.thumbnailErrorCode,
    createdAt: normalized.createdAt,
    updatedAt: normalized.updatedAt,
    nodeCount: normalized.nodes.length,
  };
}
