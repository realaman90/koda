import type { AppNode, AppEdge } from '@/lib/types';

/**
 * Canvas data structure for storage
 */
export interface StoredCanvas {
  id: string;
  name: string;
  nodes: AppNode[];
  edges: AppEdge[];
  thumbnail?: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * Canvas metadata for listing (without full node/edge data)
 */
export interface CanvasMetadata {
  id: string;
  name: string;
  thumbnail?: string;
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
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Convert full canvas to metadata (for listing)
 */
export function canvasToMetadata(canvas: StoredCanvas): CanvasMetadata {
  return {
    id: canvas.id,
    name: canvas.name,
    thumbnail: canvas.thumbnail,
    createdAt: canvas.createdAt,
    updatedAt: canvas.updatedAt,
    nodeCount: canvas.nodes.length,
  };
}
