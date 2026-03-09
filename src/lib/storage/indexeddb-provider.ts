import type { StorageProvider, StoredCanvas, CanvasMetadata } from './types';
import { canvasToMetadata, normalizeStoredCanvas } from './types';
import { getLocalStorageProvider } from './local-storage-provider';

const DB_NAME = 'koda-canvas-storage';
const DB_VERSION = 1;
const CANVAS_STORE = 'canvases';
const META_STORE = 'meta';
const LEGACY_IMPORT_KEY = 'legacy-import-complete';
const STORAGE_KEY = 'spaces-canvases';
const LEGACY_STORAGE_KEY = 'spaces-canvas-storage';

interface MetaRecord {
  key: string;
  value: string;
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

function openCanvasDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(CANVAS_STORE)) {
        db.createObjectStore(CANVAS_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function readLegacyCanvasesFromLocalStorage(): StoredCanvas[] {
  if (typeof window === 'undefined') return [];

  const canvases = new Map<string, StoredCanvas>();

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        for (const candidate of parsed) {
          if (candidate && typeof candidate === 'object' && typeof candidate.id === 'string') {
            const normalized = normalizeStoredCanvas(candidate as StoredCanvas);
            canvases.set(normalized.id, normalized);
          }
        }
      }
    }
  } catch (error) {
    console.warn('[indexeddb-provider] Failed to parse legacy canvas list:', error);
  }

  try {
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy) {
      const parsed = JSON.parse(legacy) as {
        state?: {
          nodes?: StoredCanvas['nodes'];
          edges?: StoredCanvas['edges'];
          isReadOnly?: boolean;
          spaceName?: string;
        };
      };
      const state = parsed?.state;
      if (
        state
        && !state.isReadOnly
        && ((state.nodes && state.nodes.length > 0) || (state.edges && state.edges.length > 0))
      ) {
        const now = Date.now();
        const canvas: StoredCanvas = normalizeStoredCanvas({
          id: `canvas_${now}_legacy`,
          name: state.spaceName || 'Migrated Canvas',
          nodes: state.nodes || [],
          edges: state.edges || [],
          createdAt: now,
          updatedAt: now,
        });
        canvases.set(canvas.id, canvas);
      }
    }
  } catch (error) {
    console.warn('[indexeddb-provider] Failed to parse legacy single-canvas state:', error);
  }

  return Array.from(canvases.values());
}

async function getMetaValue(db: IDBDatabase, key: string): Promise<string | null> {
  const tx = db.transaction(META_STORE, 'readonly');
  const store = tx.objectStore(META_STORE);
  const record = await requestToPromise(store.get(key) as IDBRequest<MetaRecord | undefined>);
  await transactionDone(tx);
  return record?.value ?? null;
}

async function setMetaValue(db: IDBDatabase, key: string, value: string): Promise<void> {
  const tx = db.transaction(META_STORE, 'readwrite');
  tx.objectStore(META_STORE).put({ key, value } satisfies MetaRecord);
  await transactionDone(tx);
}

async function getAllCanvases(db: IDBDatabase): Promise<StoredCanvas[]> {
  const tx = db.transaction(CANVAS_STORE, 'readonly');
  const records = await requestToPromise(
    tx.objectStore(CANVAS_STORE).getAll() as IDBRequest<StoredCanvas[]>
  );
  await transactionDone(tx);
  return (records || []).map((canvas) => normalizeStoredCanvas(canvas));
}

async function getCanvasRecord(db: IDBDatabase, id: string): Promise<StoredCanvas | null> {
  const tx = db.transaction(CANVAS_STORE, 'readonly');
  const record = await requestToPromise(
    tx.objectStore(CANVAS_STORE).get(id) as IDBRequest<StoredCanvas | undefined>
  );
  await transactionDone(tx);
  return record ? normalizeStoredCanvas(record) : null;
}

async function putCanvasRecord(db: IDBDatabase, canvas: StoredCanvas): Promise<void> {
  const tx = db.transaction(CANVAS_STORE, 'readwrite');
  tx.objectStore(CANVAS_STORE).put(normalizeStoredCanvas(canvas));
  await transactionDone(tx);
}

async function deleteCanvasRecord(db: IDBDatabase, id: string): Promise<void> {
  const tx = db.transaction(CANVAS_STORE, 'readwrite');
  tx.objectStore(CANVAS_STORE).delete(id);
  await transactionDone(tx);
}

export class IndexedDbStorageProvider implements StorageProvider {
  private fallback = getLocalStorageProvider();
  private dbPromise: Promise<IDBDatabase | null> | null = null;
  private usingFallback = false;

  private async getDb(): Promise<IDBDatabase | null> {
    if (this.usingFallback) return null;
    if (typeof window === 'undefined' || typeof indexedDB === 'undefined') {
      this.usingFallback = true;
      return null;
    }

    if (!this.dbPromise) {
      this.dbPromise = openCanvasDatabase().catch((error) => {
        console.warn('[indexeddb-provider] Falling back to localStorage:', error);
        this.usingFallback = true;
        return null;
      });
    }

    return this.dbPromise;
  }

  private async ensureReady(): Promise<IDBDatabase | null> {
    const db = await this.getDb();
    if (!db) return null;

    const imported = await getMetaValue(db, LEGACY_IMPORT_KEY);
    if (imported === '1') {
      return db;
    }

    const legacyCanvases = readLegacyCanvasesFromLocalStorage();
    if (legacyCanvases.length > 0) {
      const existingIds = new Set((await getAllCanvases(db)).map((canvas) => canvas.id));
      for (const canvas of legacyCanvases) {
        if (!existingIds.has(canvas.id)) {
          await putCanvasRecord(db, canvas);
        }
      }
    }

    await setMetaValue(db, LEGACY_IMPORT_KEY, '1');
    return db;
  }

  async listCanvases(): Promise<CanvasMetadata[]> {
    const db = await this.ensureReady();
    if (!db) return this.fallback.listCanvases();

    const canvases = await getAllCanvases(db);
    canvases.sort((a, b) => b.updatedAt - a.updatedAt);
    return canvases.map(canvasToMetadata);
  }

  async getCanvas(id: string): Promise<StoredCanvas | null> {
    const db = await this.ensureReady();
    if (!db) return this.fallback.getCanvas(id);
    return getCanvasRecord(db, id);
  }

  async saveCanvas(canvas: StoredCanvas): Promise<void> {
    const normalized = normalizeStoredCanvas({
      ...canvas,
      updatedAt: Date.now(),
    });

    const db = await this.ensureReady();
    if (!db) {
      await this.fallback.saveCanvas(normalized);
      return;
    }

    await putCanvasRecord(db, normalized);
  }

  async deleteCanvas(id: string): Promise<void> {
    const db = await this.ensureReady();
    if (!db) {
      await this.fallback.deleteCanvas(id);
      return;
    }
    await deleteCanvasRecord(db, id);
  }

  async canvasExists(id: string): Promise<boolean> {
    const db = await this.ensureReady();
    if (!db) return this.fallback.canvasExists(id);
    return (await getCanvasRecord(db, id)) !== null;
  }

  async migrateLegacyData(): Promise<string | null> {
    const db = await this.ensureReady();
    if (!db) {
      return this.fallback.migrateLegacyData?.() ?? null;
    }

    const before = new Set((await getAllCanvases(db)).map((canvas) => canvas.id));
    const legacyCanvases = readLegacyCanvasesFromLocalStorage();
    let migratedId: string | null = null;

    for (const canvas of legacyCanvases) {
      if (!before.has(canvas.id)) {
        await putCanvasRecord(db, canvas);
        migratedId ||= canvas.id;
      }
    }

    await setMetaValue(db, LEGACY_IMPORT_KEY, '1');
    return migratedId;
  }
}

let instance: IndexedDbStorageProvider | null = null;

export function getIndexedDbStorageProvider(): IndexedDbStorageProvider {
  if (!instance) {
    instance = new IndexedDbStorageProvider();
  }
  return instance;
}
