/**
 * Canvas Sync Service
 * 
 * Handles synchronization between localStorage (instant UI) and SQLite (persistent storage).
 * 
 * Flow:
 * 1. User action → localStorage (instant) → UI updates immediately
 * 2. Debounced sync → API call → SQLite (background)
 * 3. On page load → Fetch from SQLite → Merge with localStorage
 */

import type { StoredCanvas, CanvasMetadata } from './types';

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error' | 'offline';

interface SyncState {
  status: SyncStatus;
  lastSyncedAt: number | null;
  pendingChanges: Set<string>; // Canvas IDs with pending changes
  error: string | null;
}

// Singleton state
let syncState: SyncState = {
  status: 'idle',
  lastSyncedAt: null,
  pendingChanges: new Set(),
  error: null,
};

// Listeners for sync status changes
type SyncListener = (state: SyncState) => void;
const listeners: Set<SyncListener> = new Set();

function notifyListeners() {
  listeners.forEach((listener) => listener({ ...syncState }));
}

/**
 * Subscribe to sync status changes
 */
export function subscribeSyncStatus(listener: SyncListener): () => void {
  listeners.add(listener);
  // Immediately call with current state
  listener({ ...syncState });
  return () => listeners.delete(listener);
}

/**
 * Get current sync status
 */
export function getSyncStatus(): SyncState {
  return { ...syncState };
}

/**
 * Check if SQLite backend is enabled (via API)
 */
export async function isSQLiteEnabled(): Promise<boolean> {
  try {
    const response = await fetch('/api/canvases', { method: 'GET' });
    const data = await response.json();
    return data.backend === 'sqlite';
  } catch {
    return false;
  }
}

/**
 * Sync a single canvas to SQLite
 */
export async function syncCanvasToServer(canvas: StoredCanvas): Promise<boolean> {
  syncState.status = 'syncing';
  syncState.pendingChanges.add(canvas.id);
  notifyListeners();

  try {
    const response = await fetch(`/api/canvases/${canvas.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(canvas),
    });

    if (!response.ok) {
      throw new Error(`Sync failed: ${response.status}`);
    }

    syncState.pendingChanges.delete(canvas.id);
    syncState.status = syncState.pendingChanges.size > 0 ? 'syncing' : 'synced';
    syncState.lastSyncedAt = Date.now();
    syncState.error = null;
    notifyListeners();
    return true;
  } catch (error) {
    syncState.status = 'error';
    syncState.error = error instanceof Error ? error.message : 'Sync failed';
    notifyListeners();
    return false;
  }
}

/**
 * Create a new canvas on the server
 */
export async function createCanvasOnServer(canvas: StoredCanvas): Promise<boolean> {
  syncState.status = 'syncing';
  notifyListeners();

  try {
    const response = await fetch('/api/canvases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(canvas),
    });

    if (!response.ok) {
      throw new Error(`Create failed: ${response.status}`);
    }

    syncState.status = 'synced';
    syncState.lastSyncedAt = Date.now();
    syncState.error = null;
    notifyListeners();
    return true;
  } catch (error) {
    syncState.status = 'error';
    syncState.error = error instanceof Error ? error.message : 'Create failed';
    notifyListeners();
    return false;
  }
}

/**
 * Delete a canvas from the server
 */
export async function deleteCanvasFromServer(canvasId: string): Promise<boolean> {
  syncState.status = 'syncing';
  notifyListeners();

  try {
    const response = await fetch(`/api/canvases/${canvasId}`, {
      method: 'DELETE',
    });

    if (!response.ok && response.status !== 404) {
      throw new Error(`Delete failed: ${response.status}`);
    }

    syncState.status = 'synced';
    syncState.lastSyncedAt = Date.now();
    syncState.error = null;
    notifyListeners();
    return true;
  } catch (error) {
    syncState.status = 'error';
    syncState.error = error instanceof Error ? error.message : 'Delete failed';
    notifyListeners();
    return false;
  }
}

/**
 * Fetch all canvases from the server
 */
export async function fetchCanvasesFromServer(): Promise<CanvasMetadata[]> {
  try {
    const response = await fetch('/api/canvases');
    if (!response.ok) {
      throw new Error(`Fetch failed: ${response.status}`);
    }
    const data = await response.json();
    return data.canvases || [];
  } catch (error) {
    console.error('Failed to fetch canvases from server:', error);
    return [];
  }
}

/**
 * Fetch a single canvas from the server
 */
export async function fetchCanvasFromServer(id: string): Promise<StoredCanvas | null> {
  try {
    const response = await fetch(`/api/canvases/${id}`);
    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`Fetch failed: ${response.status}`);
    }
    const data = await response.json();
    return data.canvas || null;
  } catch (error) {
    console.error('Failed to fetch canvas from server:', error);
    return null;
  }
}

/**
 * Merge server canvases with local canvases
 * Strategy: Server wins for conflicts (based on updatedAt)
 */
export function mergeCanvases(
  localCanvases: StoredCanvas[],
  serverCanvases: StoredCanvas[]
): StoredCanvas[] {
  const merged = new Map<string, StoredCanvas>();

  // Add all local canvases first
  for (const canvas of localCanvases) {
    merged.set(canvas.id, canvas);
  }

  // Merge server canvases (server wins if newer)
  for (const serverCanvas of serverCanvases) {
    const localCanvas = merged.get(serverCanvas.id);
    
    if (!localCanvas) {
      // Canvas only exists on server - add it
      merged.set(serverCanvas.id, serverCanvas);
    } else if (serverCanvas.updatedAt > localCanvas.updatedAt) {
      // Server version is newer - use it
      merged.set(serverCanvas.id, serverCanvas);
    }
    // Otherwise keep local version (it's newer or same)
  }

  return Array.from(merged.values());
}

/**
 * Initial sync on app load
 * Fetches canvases from server and merges with localStorage
 */
export async function performInitialSync(
  getLocalCanvases: () => Promise<StoredCanvas[]>,
  saveLocalCanvases: (canvases: StoredCanvas[]) => Promise<void>
): Promise<StoredCanvas[]> {
  // Check if SQLite is enabled
  const sqliteEnabled = await isSQLiteEnabled();
  
  if (!sqliteEnabled) {
    // No SQLite - just return local canvases
    return getLocalCanvases();
  }

  syncState.status = 'syncing';
  notifyListeners();

  try {
    // Fetch from both sources
    const [localCanvases, serverCanvasMetadata] = await Promise.all([
      getLocalCanvases(),
      fetchCanvasesFromServer(),
    ]);

    // Fetch full canvas data from server
    const serverCanvases = await Promise.all(
      serverCanvasMetadata.map((meta) => fetchCanvasFromServer(meta.id))
    );

    const validServerCanvases = serverCanvases.filter(
      (c): c is StoredCanvas => c !== null
    );

    // Merge canvases
    const merged = mergeCanvases(localCanvases, validServerCanvases);

    // Save merged result to localStorage
    await saveLocalCanvases(merged);

    // Sync any local-only canvases to server
    const serverIds = new Set(validServerCanvases.map((c) => c.id));
    const localOnlyCanvases = localCanvases.filter((c) => !serverIds.has(c.id));
    
    for (const canvas of localOnlyCanvases) {
      await createCanvasOnServer(canvas);
    }

    syncState.status = 'synced';
    syncState.lastSyncedAt = Date.now();
    syncState.error = null;
    notifyListeners();

    return merged;
  } catch (error) {
    console.error('Initial sync failed:', error);
    syncState.status = 'error';
    syncState.error = error instanceof Error ? error.message : 'Sync failed';
    notifyListeners();

    // Fall back to local canvases
    return getLocalCanvases();
  }
}
