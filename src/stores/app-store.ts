import { create } from 'zustand';
import type { CanvasMetadata, StoredCanvas } from '@/lib/storage';
import {
  getStorageProvider,
  getLocalStorageProvider,
  createEmptyCanvas,
} from '@/lib/storage';
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
    const provider = getStorageProvider();
    const canvas = createEmptyCanvas(name || 'Untitled Canvas');

    await provider.saveCanvas(canvas);

    // Refresh the canvas list
    await get().loadCanvasList();

    return canvas.id;
  },

  createCanvasFromTemplate: async (template: Template) => {
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

    await provider.saveCanvas(canvas);

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

    await provider.saveCanvas(duplicate);

    // Refresh the canvas list
    await get().loadCanvasList();

    return duplicate.id;
  },

  deleteCanvas: async (id: string) => {
    const provider = getStorageProvider();

    await provider.deleteCanvas(id);

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
    const { currentCanvasId, currentCanvasName } = get();
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

      await provider.saveCanvas(canvas);

      set({
        hasUnsavedChanges: false,
        lastSavedAt: canvas.updatedAt,
      });
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
