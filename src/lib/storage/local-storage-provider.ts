import type { StorageProvider, StoredCanvas, CanvasMetadata } from './types';
import { canvasToMetadata, normalizeStoredCanvas } from './types';

const STORAGE_KEY = 'spaces-canvases';
const LEGACY_STORAGE_KEY = 'spaces-canvas-storage';

/**
 * localStorage implementation of StorageProvider
 * Stores all canvases as a JSON array in localStorage
 */
export class LocalStorageProvider implements StorageProvider {
  private canvases: Map<string, StoredCanvas> = new Map();
  private initialized = false;

  constructor() {
    // Lazy initialization - load from localStorage on first access
  }

  private ensureInitialized(): void {
    if (this.initialized) return;

    if (typeof window === 'undefined') {
      this.initialized = true;
      return;
    }

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const canvases: StoredCanvas[] = JSON.parse(stored);
        canvases.forEach((canvas) => {
          const normalized = normalizeStoredCanvas(canvas);
          this.canvases.set(normalized.id, normalized);
        });
      }
    } catch (error) {
      console.error('Failed to load canvases from localStorage:', error);
    }

    this.initialized = true;
  }

  private persist(): void {
    if (typeof window === 'undefined') return;

    try {
      const canvases = Array.from(this.canvases.values());
      // Use a replacer to strip large data: URLs and heavy state that would
      // blow the ~5MB localStorage quota (a single base64 image can be 5MB+).
      const json = JSON.stringify(canvases, (_key, value) => {
        if (typeof value === 'string' && value.length > 2048) {
          // Strip base64 data URLs — they're too large for localStorage
          if (value.startsWith('data:')) return '';
          // Strip blob URLs — they're session-only and won't work after reload
          if (value.startsWith('blob:')) return '';
        }
        return value;
      });
      localStorage.setItem(STORAGE_KEY, json);
    } catch (error) {
      console.error('Failed to persist canvases to localStorage:', error);
    }
  }

  async listCanvases(): Promise<CanvasMetadata[]> {
    this.ensureInitialized();

    const canvases = Array.from(this.canvases.values());
    // Sort by updatedAt descending (most recent first)
    canvases.sort((a, b) => b.updatedAt - a.updatedAt);

    return canvases.map(canvasToMetadata);
  }

  async getCanvas(id: string): Promise<StoredCanvas | null> {
    this.ensureInitialized();
    const canvas = this.canvases.get(id);
    return canvas ? normalizeStoredCanvas(canvas) : null;
  }

  async saveCanvas(canvas: StoredCanvas): Promise<void> {
    this.ensureInitialized();

    // Ensure updatedAt is set
    canvas.updatedAt = Date.now();

    this.canvases.set(canvas.id, normalizeStoredCanvas(canvas));
    this.persist();
  }

  async deleteCanvas(id: string): Promise<void> {
    this.ensureInitialized();

    this.canvases.delete(id);
    this.persist();
  }

  async canvasExists(id: string): Promise<boolean> {
    this.ensureInitialized();
    return this.canvases.has(id);
  }

  /**
   * Migrate data from legacy single-canvas storage format
   * Returns the migrated canvas ID if migration occurred, null otherwise
   */
  async migrateLegacyData(): Promise<string | null> {
    if (typeof window === 'undefined') return null;

    try {
      const legacyData = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (!legacyData) return null;

      const parsed = JSON.parse(legacyData);
      const state = parsed.state;

      if (!state || (!state.nodes?.length && !state.edges?.length)) {
        // No meaningful data to migrate
        return null;
      }

      // Check if we already have canvases (avoid double migration)
      this.ensureInitialized();
      if (this.canvases.size > 0) {
        // Already have canvases, don't migrate
        return null;
      }

      // Create a new canvas from legacy data
      const now = Date.now();
      const migratedCanvas: StoredCanvas = {
        id: `canvas_${now}_migrated`,
        name: state.spaceName || 'Migrated Canvas',
        nodes: state.nodes || [],
        edges: state.edges || [],
        createdAt: now,
        updatedAt: now,
      };

      // Save the migrated canvas
      this.canvases.set(migratedCanvas.id, migratedCanvas);
      this.persist();

      // Clear the legacy storage to prevent re-migration
      localStorage.removeItem(LEGACY_STORAGE_KEY);

      console.log('Migrated legacy canvas data:', migratedCanvas.id);
      return migratedCanvas.id;
    } catch (error) {
      console.error('Failed to migrate legacy data:', error);
      return null;
    }
  }

  /**
   * Force reload from localStorage (useful for debugging or external changes)
   */
  reload(): void {
    this.initialized = false;
    this.canvases.clear();
    this.ensureInitialized();
  }
}

// Singleton instance
let instance: LocalStorageProvider | null = null;

export function getLocalStorageProvider(): LocalStorageProvider {
  if (!instance) {
    instance = new LocalStorageProvider();
  }
  return instance;
}
