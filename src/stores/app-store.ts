import { create } from 'zustand';
import type { CanvasMetadata, StoredCanvas } from '@/lib/storage';
import {
  getStorageProvider,
  getLocalStorageProvider,
  createEmptyCanvas,
  isSQLiteConfigured,
} from '@/lib/storage';
import {
  syncCanvasToServer,
  createCanvasOnServer,
  deleteCanvasFromServer,
  performInitialSync,
  subscribeSyncStatus,
  type SyncStatus,
} from '@/lib/storage/sync-service';
import { useCanvasStore } from './canvas-store';
import type { Template } from '@/lib/templates/types';

interface AppState {
  // Current canvas being edited
  currentCanvasId: string | null;
  currentCanvasName: string;

  // Canvas list for dashboard
  canvasList: CanvasMetadata[];
  isLoadingList: boolean;

  // Save status
  isSaving: boolean;
  lastSavedAt: number | null;
  hasUnsavedChanges: boolean;

  // Sync status (for SQLite backend)
  syncStatus: SyncStatus;
  syncError: string | null;
  isSyncEnabled: boolean;

  // Actions
  loadCanvasList: () => Promise<void>;
  loadCanvas: (id: string) => Promise<boolean>;
  createCanvas: (name?: string) => Promise<string>;
  createCanvasFromTemplate: (template: Template) => Promise<string>;
  renameCanvas: (id: string, name: string) => Promise<void>;
  duplicateCanvas: (id: string) => Promise<string | null>;
  deleteCanvas: (id: string) => Promise<void>;
  saveCurrentCanvas: () => Promise<void>;
  setCurrentCanvasName: (name: string) => void;
  markUnsavedChanges: () => void;

  // Migration
  migrateLegacyData: () => Promise<string | null>;

  // Sync
  initializeSync: () => Promise<void>;
}

// Debounce timer for auto-save
let saveDebounceTimer: ReturnType<typeof setTimeout> | null = null;
const SAVE_DEBOUNCE_MS = 1000;

export const useAppStore = create<AppState>()((set, get) => ({
  // Initial state
  currentCanvasId: null,
  currentCanvasName: 'Untitled Canvas',
  canvasList: [],
  isLoadingList: false,
  isSaving: false,
  lastSavedAt: null,
  hasUnsavedChanges: false,
  syncStatus: 'idle',
  syncError: null,
  isSyncEnabled: false,

  initializeSync: async () => {
    // Check if SQLite is configured
    const syncEnabled = isSQLiteConfigured();
    set({ isSyncEnabled: syncEnabled });

    if (!syncEnabled) {
      return;
    }

    // Subscribe to sync status changes
    subscribeSyncStatus((state) => {
      set({ syncStatus: state.status, syncError: state.error });
    });

    // Perform initial sync
    const localProvider = getLocalStorageProvider();
    
    await performInitialSync(
      async () => {
        const metaList = await localProvider.listCanvases();
        const canvases: StoredCanvas[] = [];
        for (const meta of metaList) {
          const canvas = await localProvider.getCanvas(meta.id);
          if (canvas) canvases.push(canvas);
        }
        return canvases;
      },
      async (canvases) => {
        for (const canvas of canvases) {
          await localProvider.saveCanvas(canvas);
        }
      }
    );

    // Reload canvas list after sync
    await get().loadCanvasList();
  },

  loadCanvasList: async () => {
    set({ isLoadingList: true });

    try {
      const provider = getStorageProvider();
      const canvases = await provider.listCanvases();
      set({ canvasList: canvases });
    } catch (error) {
      console.error('Failed to load canvas list:', error);
    } finally {
      set({ isLoadingList: false });
    }
  },

  loadCanvas: async (id: string) => {
    const provider = getStorageProvider();

    try {
      const canvas = await provider.getCanvas(id);
      if (!canvas) {
        return false;
      }

      // Load canvas data into the canvas store
      const canvasStore = useCanvasStore.getState();

      // Reset canvas store state and load the canvas
      canvasStore.loadCanvasData(canvas.nodes, canvas.edges);

      set({
        currentCanvasId: canvas.id,
        currentCanvasName: canvas.name,
        hasUnsavedChanges: false,
        lastSavedAt: canvas.updatedAt,
      });

      return true;
    } catch (error) {
      console.error('Failed to load canvas:', error);
      return false;
    }
  },

  createCanvas: async (name?: string) => {
    const { isSyncEnabled } = get();
    const provider = getStorageProvider();
    const canvas = createEmptyCanvas(name || 'Untitled Canvas');

    // Save to localStorage first
    await provider.saveCanvas(canvas);

    // Sync to SQLite (if enabled)
    if (isSyncEnabled) {
      createCanvasOnServer(canvas).catch((err) => {
        console.error('Failed to sync new canvas:', err);
      });
    }

    // Refresh the canvas list
    await get().loadCanvasList();

    return canvas.id;
  },

  createCanvasFromTemplate: async (template: Template) => {
    const { isSyncEnabled } = get();
    const provider = getStorageProvider();
    const now = Date.now();

    const canvas: StoredCanvas = {
      id: `canvas_${now}_${Math.random().toString(36).slice(2, 9)}`,
      name: template.name,
      nodes: JSON.parse(JSON.stringify(template.nodes)), // Deep clone
      edges: JSON.parse(JSON.stringify(template.edges)),
      createdAt: now,
      updatedAt: now,
    };

    // Save to localStorage first
    await provider.saveCanvas(canvas);

    // Sync to SQLite (if enabled)
    if (isSyncEnabled) {
      createCanvasOnServer(canvas).catch((err) => {
        console.error('Failed to sync template canvas:', err);
      });
    }

    // Refresh the canvas list
    await get().loadCanvasList();

    return canvas.id;
  },

  renameCanvas: async (id: string, name: string) => {
    const provider = getStorageProvider();

    const canvas = await provider.getCanvas(id);
    if (!canvas) return;

    canvas.name = name;
    canvas.updatedAt = Date.now();

    await provider.saveCanvas(canvas);

    // Update current canvas name if this is the current canvas
    if (get().currentCanvasId === id) {
      set({ currentCanvasName: name });
    }

    // Refresh the canvas list
    await get().loadCanvasList();
  },

  duplicateCanvas: async (id: string) => {
    const { isSyncEnabled } = get();
    const provider = getStorageProvider();

    const original = await provider.getCanvas(id);
    if (!original) return null;

    const now = Date.now();
    const duplicate: StoredCanvas = {
      id: `canvas_${now}_${Math.random().toString(36).slice(2, 9)}`,
      name: `${original.name} (Copy)`,
      nodes: JSON.parse(JSON.stringify(original.nodes)),
      edges: JSON.parse(JSON.stringify(original.edges)),
      thumbnail: original.thumbnail,
      createdAt: now,
      updatedAt: now,
    };

    // Save to localStorage first
    await provider.saveCanvas(duplicate);

    // Sync to SQLite (if enabled)
    if (isSyncEnabled) {
      createCanvasOnServer(duplicate).catch((err) => {
        console.error('Failed to sync duplicated canvas:', err);
      });
    }

    // Refresh the canvas list
    await get().loadCanvasList();

    return duplicate.id;
  },

  deleteCanvas: async (id: string) => {
    const { isSyncEnabled } = get();
    const provider = getStorageProvider();

    // Delete from localStorage first
    await provider.deleteCanvas(id);

    // Sync deletion to SQLite (if enabled)
    if (isSyncEnabled) {
      deleteCanvasFromServer(id).catch((err) => {
        console.error('Failed to sync canvas deletion:', err);
      });
    }

    // Clear current canvas if it was deleted
    if (get().currentCanvasId === id) {
      set({
        currentCanvasId: null,
        currentCanvasName: 'Untitled Canvas',
        hasUnsavedChanges: false,
      });
    }

    // Refresh the canvas list
    await get().loadCanvasList();
  },

  saveCurrentCanvas: async () => {
    const { currentCanvasId, currentCanvasName, isSyncEnabled } = get();
    if (!currentCanvasId) return;

    const canvasStore = useCanvasStore.getState();
    const provider = getStorageProvider();

    set({ isSaving: true });

    try {
      const canvas: StoredCanvas = {
        id: currentCanvasId,
        name: currentCanvasName,
        nodes: canvasStore.nodes,
        edges: canvasStore.edges,
        createdAt: 0, // Will be set by provider if new
        updatedAt: Date.now(),
      };

      // Get existing canvas to preserve createdAt
      const existing = await provider.getCanvas(currentCanvasId);
      if (existing) {
        canvas.createdAt = existing.createdAt;
      } else {
        canvas.createdAt = Date.now();
      }

      // Save to localStorage first (instant)
      await provider.saveCanvas(canvas);

      set({
        hasUnsavedChanges: false,
        lastSavedAt: canvas.updatedAt,
      });

      // Sync to SQLite in background (if enabled)
      if (isSyncEnabled) {
        // Don't await - let it run in background
        syncCanvasToServer(canvas).catch((err) => {
          console.error('Background sync failed:', err);
        });
      }
    } catch (error) {
      console.error('Failed to save canvas:', error);
    } finally {
      set({ isSaving: false });
    }
  },

  setCurrentCanvasName: (name: string) => {
    set({ currentCanvasName: name, hasUnsavedChanges: true });

    // Trigger debounced save
    get().markUnsavedChanges();
  },

  markUnsavedChanges: () => {
    set({ hasUnsavedChanges: true });

    // Debounced auto-save
    if (saveDebounceTimer) {
      clearTimeout(saveDebounceTimer);
    }

    saveDebounceTimer = setTimeout(() => {
      get().saveCurrentCanvas();
    }, SAVE_DEBOUNCE_MS);
  },

  migrateLegacyData: async () => {
    const localProvider = getLocalStorageProvider();
    return localProvider.migrateLegacyData();
  },
}));

// Subscribe to canvas store changes and trigger auto-save
// This is done outside the store to avoid circular dependency issues
if (typeof window !== 'undefined') {
  useCanvasStore.subscribe((state, prevState) => {
    // Only trigger save if nodes or edges changed
    if (state.nodes !== prevState.nodes || state.edges !== prevState.edges) {
      const appStore = useAppStore.getState();
      if (appStore.currentCanvasId) {
        appStore.markUnsavedChanges();
      }
    }
  });
}
