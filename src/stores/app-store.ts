import { create } from 'zustand';
import type { CanvasMetadata, StoredCanvas } from '@/lib/storage';
import {
  getStorageProvider,
  createEmptyCanvas,
} from '@/lib/storage';
import {
  syncCanvasToServer,
  createCanvasOnServer,
  deleteCanvasFromServer,
  performInitialSync,
  subscribeSyncStatus,
  type SyncStatus,
} from '@/lib/storage/sync-service';
import { uploadAsset } from '@/lib/assets/upload';
import { captureCanvasPreview, makeThumbnailVersion } from '@/lib/preview-utils';
import { PreviewLifecycleQueue } from '@/lib/preview-lifecycle';
import { useCanvasStore } from './canvas-store';
import type { Template } from '@/lib/templates/types';
import { parseSyncCapabilityProbe } from '@/lib/runtime/sync-capability';
import type { AppNode, PluginNodeData } from '@/lib/types';
import { resolveCanvasPersistencePlan } from '@/lib/canvas-persistence';
import { createCanvasMutationRecord, type CanvasMutationKind, type CanvasMutationRecord } from './canvas-store-helpers';

type SyncCapability = 'unknown' | 'db-sync-available' | 'local-only' | 'provisioning-blocked';
type SaveScope = 'local' | 'server' | 'full';

interface SaveCurrentCanvasOptions {
  scope?: SaveScope;
  triggerPreview?: boolean;
}

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
  syncCapability: SyncCapability;
  isSyncEnabled: boolean;

  // Actions
  loadCanvasList: () => Promise<void>;
  loadCanvas: (id: string) => Promise<boolean>;
  createCanvas: (name?: string) => Promise<string>;
  createCanvasFromTemplate: (template: Template) => Promise<string>;
  renameCanvas: (id: string, name: string) => Promise<void>;
  duplicateCanvas: (id: string) => Promise<string | null>;
  deleteCanvas: (id: string) => Promise<void>;
  saveCurrentCanvas: (options?: SaveCurrentCanvasOptions) => Promise<void>;
  flushCanvasPersistence: (triggerPreview?: boolean) => Promise<void>;
  scheduleCanvasPersistence: (mutation: CanvasMutationRecord) => void;
  clearCurrentCanvas: () => void;
  setCurrentCanvasName: (name: string) => void;
  markUnsavedChanges: (kind?: CanvasMutationKind) => void;
  updateCanvasThumbnail: (id: string, patch: Pick<StoredCanvas, 'thumbnail' | 'thumbnailUrl' | 'thumbnailStatus' | 'thumbnailUpdatedAt' | 'thumbnailVersion' | 'thumbnailErrorCode'>) => Promise<void>;
  requestPreviewRefresh: (id: string, force?: boolean) => Promise<void>;

  // Migration
  migrateLegacyData: () => Promise<string | null>;

  // Sync
  initializeSync: () => Promise<void>;
}

let localPersistTimer: ReturnType<typeof setTimeout> | null = null;
let serverSyncTimer: ReturnType<typeof setTimeout> | null = null;
let pendingPreviewRefresh = false;
const PREVIEW_DEBOUNCE_MS = 2000;
const PREVIEW_SYSTEM_ENABLED = process.env.NEXT_PUBLIC_UX_PREVIEW_SYSTEM_V1 !== 'false';
const PREVIEW_BUSY_RETRY_MS = 3000;
let syncStatusUnsubscribe: (() => void) | null = null;
const previewBusyRetryTimers = new Map<string, ReturnType<typeof setTimeout>>();

function clearPersistenceTimers(): void {
  if (localPersistTimer) {
    clearTimeout(localPersistTimer);
    localPersistTimer = null;
  }

  if (serverSyncTimer) {
    clearTimeout(serverSyncTimer);
    serverSyncTimer = null;
  }
}

function buildGraphSignature(canvas: Pick<StoredCanvas, 'nodes' | 'edges'>): string {
  return JSON.stringify({ nodes: canvas.nodes, edges: canvas.edges });
}

function mapPreviewErrorCode(error: unknown): 'UPLOAD_FAILED' | 'CAPTURE_FAILED' | 'UNKNOWN' {
  if (error instanceof Error) {
    if (error.message.includes('CAPTURE_FAILED')) return 'CAPTURE_FAILED';
    if (error.message.toLowerCase().includes('upload')) return 'UPLOAD_FAILED';
  }
  return 'UNKNOWN';
}

function isAnimationNodeBusy(node: AppNode): boolean {
  if (node.type !== 'pluginNode') return false;
  const pluginData = node.data as PluginNodeData;
  if (pluginData.pluginId !== 'animation-generator') return false;

  const state = pluginData.state as {
    phase?: string;
    sandboxStatus?: string;
    toolCalls?: Array<{ status?: string }>;
  } | undefined;

  if (!state) return false;
  if (state.phase === 'executing') return true;
  if (state.sandboxStatus === 'busy') return true;
  return Array.isArray(state.toolCalls) && state.toolCalls.some((tc) => tc?.status === 'running');
}

function hasActiveAnimationExecution(nodes: AppNode[]): boolean {
  return nodes.some(isAnimationNodeBusy);
}

function schedulePreviewRetry(canvasId: string): void {
  if (previewBusyRetryTimers.has(canvasId)) return;
  const timer = setTimeout(() => {
    previewBusyRetryTimers.delete(canvasId);
    useAppStore.getState().requestPreviewRefresh(canvasId, true).catch((err) => {
      console.error('[preview] Retry refresh failed:', err);
    });
  }, PREVIEW_BUSY_RETRY_MS);
  previewBusyRetryTimers.set(canvasId, timer);
}

const previewQueue = new PreviewLifecycleQueue({
  debounceMs: PREVIEW_DEBOUNCE_MS,
  run: async (id) => {
    const { updateCanvasThumbnail } = useAppStore.getState();
    const provider = getStorageProvider();

    try {
      await updateCanvasThumbnail(id, {
        thumbnailStatus: 'processing',
        thumbnailErrorCode: undefined,
      });

      // Wait briefly for the DOM to settle (React Flow can lag behind state updates)
      let canvasElement = document.querySelector('.react-flow') as HTMLElement | null;
      if (!canvasElement) {
        await new Promise((r) => setTimeout(r, 500));
        canvasElement = document.querySelector('.react-flow') as HTMLElement | null;
      }

      if (!canvasElement) {
        // Not on canvas page — keep existing preview if any, otherwise stay empty (not error)
        const current = await provider.getCanvas(id);
        const hasExisting = !!(current?.thumbnail || current?.thumbnailUrl);
        await updateCanvasThumbnail(id, {
          thumbnail: current?.thumbnail,
          thumbnailUrl: current?.thumbnailUrl,
          thumbnailStatus: hasExisting ? 'ready' : 'empty',
          ...(hasExisting && {
            thumbnailUpdatedAt: Date.now(),
            thumbnailVersion: makeThumbnailVersion(),
          }),
          thumbnailErrorCode: undefined,
        });
        return;
      }

      const blob = await captureCanvasPreview(canvasElement);
      const file = new File([blob], `canvas-preview-${id}.jpg`, { type: 'image/jpeg' });
      const uploaded = await uploadAsset(file, { canvasId: id });

      await updateCanvasThumbnail(id, {
        thumbnail: uploaded.url,
        thumbnailUrl: uploaded.url,
        thumbnailStatus: 'ready',
        thumbnailUpdatedAt: Date.now(),
        thumbnailVersion: makeThumbnailVersion(),
        thumbnailErrorCode: undefined,
      });
    } catch (error) {
      console.error('[preview] Capture failed for canvas', id, error);
      const current = await provider.getCanvas(id);
      await updateCanvasThumbnail(id, {
        thumbnail: current?.thumbnail,
        thumbnailUrl: current?.thumbnailUrl,
        thumbnailStatus: 'error',
        thumbnailErrorCode: mapPreviewErrorCode(error),
      });
    }
  },
});

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
  syncCapability: 'unknown',
  isSyncEnabled: false,

  initializeSync: async () => {
    let probeResponse: Response | null = null;

    try {
      probeResponse = await fetch('/api/runtime/sync-capability', { method: 'GET' });
    } catch {
      set({
        isSyncEnabled: false,
        syncCapability: 'local-only',
        syncError: null,
      });
      return;
    }

    if (!probeResponse.ok) {
      set({
        isSyncEnabled: false,
        syncCapability: 'local-only',
        syncError: null,
      });
      return;
    }

    const probePayload = await probeResponse.json().catch(() => null);
    const probe = parseSyncCapabilityProbe(probePayload);

    if (!probe) {
      set({
        isSyncEnabled: false,
        syncCapability: 'local-only',
        syncError: null,
      });
      return;
    }

    if (probe.mode === 'local-only') {
      set({
        isSyncEnabled: false,
        syncCapability: 'local-only',
        syncError: null,
      });
      return;
    }

    if (probe.mode === 'provisioning-blocked') {
      set({
        isSyncEnabled: false,
        syncCapability: 'provisioning-blocked',
        syncError: probe.message || 'User provisioning is incomplete.',
      });
      return;
    }

    set({
      isSyncEnabled: true,
      syncCapability: 'db-sync-available',
      syncError: null,
    });

    // Subscribe to sync status changes
    if (!syncStatusUnsubscribe) {
      syncStatusUnsubscribe = subscribeSyncStatus((state) => {
        set({ syncStatus: state.status, syncError: state.error });
      });
    }

    // Perform initial sync
    const provider = getStorageProvider();

    await performInitialSync(
      async () => {
        const metaList = await provider.listCanvases();
        const canvases: StoredCanvas[] = [];
        for (const meta of metaList) {
          const canvas = await provider.getCanvas(meta.id);
          if (canvas) canvases.push(canvas);
        }
        return canvases;
      },
      async (canvases) => {
        for (const canvas of canvases) {
          await provider.saveCanvas(canvas);
        }
      }
    );

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
      clearPersistenceTimers();
      pendingPreviewRefresh = false;

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

  clearCurrentCanvas: () => {
    clearPersistenceTimers();
    pendingPreviewRefresh = false;

    set({
      currentCanvasId: null,
      currentCanvasName: 'Untitled Canvas',
      hasUnsavedChanges: false,
      lastSavedAt: null,
      isSaving: false,
    });
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
      thumbnailUrl: original.thumbnailUrl,
      thumbnailStatus: original.thumbnailStatus,
      thumbnailUpdatedAt: original.thumbnailUpdatedAt,
      thumbnailVersion: original.thumbnailVersion,
      thumbnailErrorCode: original.thumbnailErrorCode,
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
      clearPersistenceTimers();
      pendingPreviewRefresh = false;
      set({
        currentCanvasId: null,
        currentCanvasName: 'Untitled Canvas',
        hasUnsavedChanges: false,
      });
    }

    // Refresh the canvas list
    await get().loadCanvasList();
  },

  saveCurrentCanvas: async ({ scope = 'full', triggerPreview = false }: SaveCurrentCanvasOptions = {}) => {
    const { currentCanvasId, currentCanvasName, isSyncEnabled } = get();
    if (!currentCanvasId) return;

    const canvasStore = useCanvasStore.getState();
    const provider = getStorageProvider();
    const shouldPersistLocal = scope === 'local' || scope === 'full';
    const shouldSyncServer = isSyncEnabled && (scope === 'server' || scope === 'full');

    set({ isSaving: true });

    try {
      const existing = await provider.getCanvas(currentCanvasId);
      const canvas: StoredCanvas = {
        id: currentCanvasId,
        name: currentCanvasName,
        nodes: canvasStore.nodes,
        edges: canvasStore.edges,
        thumbnail: existing?.thumbnail,
        thumbnailUrl: existing?.thumbnailUrl,
        thumbnailStatus: existing?.thumbnailStatus,
        thumbnailUpdatedAt: existing?.thumbnailUpdatedAt,
        thumbnailVersion: existing?.thumbnailVersion,
        thumbnailErrorCode: existing?.thumbnailErrorCode,
        createdAt: existing?.createdAt ?? Date.now(),
        updatedAt: Date.now(),
      };

      if (shouldPersistLocal) {
        await provider.saveCanvas(canvas);

        set({
          hasUnsavedChanges: false,
          lastSavedAt: canvas.updatedAt,
        });
      }

      if (shouldSyncServer) {
        await syncCanvasToServer(canvas).catch((err) => {
          console.error('Background sync failed:', err);
        });
      }

      if (triggerPreview && PREVIEW_SYSTEM_ENABLED) {
        get().requestPreviewRefresh(currentCanvasId).catch((err) => {
          console.error('Preview refresh failed:', err);
        });
      }
    } catch (error) {
      console.error('Failed to save canvas:', error);
    } finally {
      set({ isSaving: false });
    }
  },

  flushCanvasPersistence: async (triggerPreview = pendingPreviewRefresh) => {
    clearPersistenceTimers();
    pendingPreviewRefresh = false;
    await get().saveCurrentCanvas({ scope: 'full', triggerPreview });
  },

  scheduleCanvasPersistence: (mutation) => {
    const { currentCanvasId, isSyncEnabled } = get();
    if (!currentCanvasId) return;

    const plan = resolveCanvasPersistencePlan(mutation);
    if (plan.localDelayMs === null && plan.serverDelayMs === null) {
      return;
    }

    set({ hasUnsavedChanges: true });

    if (plan.previewEligible) {
      pendingPreviewRefresh = true;
    }

    if (plan.localDelayMs !== null) {
      if (localPersistTimer) {
        clearTimeout(localPersistTimer);
      }

      localPersistTimer = setTimeout(() => {
        localPersistTimer = null;
        const shouldTriggerPreview = pendingPreviewRefresh;
        pendingPreviewRefresh = false;
        get().saveCurrentCanvas({ scope: 'local', triggerPreview: shouldTriggerPreview }).catch((error) => {
          console.error('Local canvas save failed:', error);
        });
      }, plan.localDelayMs);
    }

    if (isSyncEnabled && plan.serverDelayMs !== null) {
      if (serverSyncTimer) {
        clearTimeout(serverSyncTimer);
      }

      serverSyncTimer = setTimeout(() => {
        serverSyncTimer = null;
        get().saveCurrentCanvas({ scope: 'server', triggerPreview: false }).catch((error) => {
          console.error('Server canvas sync failed:', error);
        });
      }, plan.serverDelayMs);
    }
  },

  setCurrentCanvasName: (name: string) => {
    set({ currentCanvasName: name, hasUnsavedChanges: true });
    get().markUnsavedChanges('content');
  },

  markUnsavedChanges: (kind = 'content') => {
    get().scheduleCanvasPersistence(
      createCanvasMutationRecord({
        kind,
        history: 'skip',
      })
    );
  },

  updateCanvasThumbnail: async (id, patch) => {
    const { isSyncEnabled } = get();
    const provider = getStorageProvider();
    const existing = await provider.getCanvas(id);
    if (!existing) return;

    const next: StoredCanvas = {
      ...existing,
      ...patch,
      thumbnail: patch.thumbnail ?? patch.thumbnailUrl ?? existing.thumbnail,
      updatedAt: Date.now(),
    };

    await provider.saveCanvas(next);

    if (isSyncEnabled) {
      syncCanvasToServer(next).catch((err) => {
        console.error('Thumbnail sync failed:', err);
      });
    }

    if (get().currentCanvasId !== id) {
      await get().loadCanvasList();
    }
  },

  requestPreviewRefresh: async (id, force = false) => {
    if (!PREVIEW_SYSTEM_ENABLED) return;

    // Avoid hammering /api/assets/upload while animation generation is actively running.
    // During execution, plugin state changes frequently (streaming text/tool updates),
    // which otherwise triggers repeated preview captures and uploads.
    if (get().currentCanvasId === id) {
      const liveNodes = useCanvasStore.getState().nodes as AppNode[];
      if (hasActiveAnimationExecution(liveNodes)) {
        schedulePreviewRetry(id);
        return;
      }
    }

    const provider = getStorageProvider();
    const canvas = await provider.getCanvas(id);
    if (!canvas) return;

    // Auto-retry when the previous capture failed (error state gets stuck
    // because the signature hasn't changed, so the queue skips it)
    const shouldForce = force || canvas.thumbnailStatus === 'error';

    const signature = buildGraphSignature(canvas);
    previewQueue.request(id, signature, shouldForce);
  },

  migrateLegacyData: async () => {
    const provider = getStorageProvider();
    return provider.migrateLegacyData ? provider.migrateLegacyData() : null;
  },
}));

// Subscribe to structured canvas mutations and schedule persistence.
if (typeof window !== 'undefined') {
  useCanvasStore.subscribe((state, prevState) => {
    const nextMutation = state.lastMutation;
    if (!nextMutation) return;
    if (nextMutation === prevState.lastMutation || nextMutation.id === prevState.lastMutation?.id) return;

    const appStore = useAppStore.getState();
    if (appStore.currentCanvasId) {
      appStore.scheduleCanvasPersistence(nextMutation);
    }
  });
}
