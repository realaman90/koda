/**
 * Media Data Cache — IndexedDB-backed storage for large base64 data URLs.
 *
 * localStorage has a ~5MB quota which base64 uploads easily exceed.
 * IndexedDB supports hundreds of MB and persists across page refreshes.
 *
 * Architecture:
 *   - In-memory Map for fast synchronous reads (populated on first access)
 *   - IndexedDB for durable persistence
 *   - Node state stores only "cached:<id>" placeholders
 */

const DB_NAME = 'koda-media-cache';
const DB_VERSION = 1;
const STORE_NAME = 'media';

// ─── In-memory read cache ─────────────────────────────────────────────
const memoryCache = new Map<string, string>();

// ─── IndexedDB helpers ────────────────────────────────────────────────

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function idbGet(key: string): Promise<string | undefined> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result as string | undefined);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return undefined;
  }
}

async function idbSet(key: string, value: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(value, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // Silently fail — media just won't persist across refresh
  }
}

async function idbDelete(key: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // Silently fail
  }
}

// ─── Public API ───────────────────────────────────────────────────────

/**
 * Store a large data URL. Writes to both memory and IndexedDB.
 * Returns the cache placeholder string to store in node state.
 */
export function cacheMediaData(entryId: string, dataUrl: string): string {
  memoryCache.set(entryId, dataUrl);
  // Fire-and-forget IndexedDB write
  idbSet(entryId, dataUrl);
  return `cached:${entryId}`;
}

/**
 * If a data URL is large (base64 > 1KB), cache it and return a placeholder.
 * Short URLs (external http links) pass through unchanged.
 */
export function cacheIfLarge(entryId: string, dataUrl: string): string {
  if (dataUrl.startsWith('data:') && dataUrl.length > 1024) {
    return cacheMediaData(entryId, dataUrl);
  }
  return dataUrl;
}

/**
 * Get cached data URL synchronously from memory.
 * Returns undefined if not in memory (call loadFromDB to hydrate).
 */
export function getCached(entryId: string): string | undefined {
  return memoryCache.get(entryId);
}

/**
 * Load a cached entry from IndexedDB into memory. Call on mount for
 * any entries that have "cached:" placeholders.
 */
export async function loadFromDB(entryId: string): Promise<string | undefined> {
  // Already in memory — skip DB
  const mem = memoryCache.get(entryId);
  if (mem) return mem;

  const data = await idbGet(entryId);
  if (data) {
    memoryCache.set(entryId, data);
  }
  return data;
}

/**
 * Remove cached data from both memory and IndexedDB.
 */
export function removeCached(entryId: string): void {
  memoryCache.delete(entryId);
  idbDelete(entryId);
}

/**
 * Resolve "cached:<id>" placeholders in media entries.
 * Uses the synchronous memory cache — call hydrateMediaCache first
 * to ensure entries are loaded from IndexedDB.
 */
export function resolveMediaCache<T extends { id: string; dataUrl: string }>(entries: T[]): T[] {
  return entries.map((m) => {
    if (m.dataUrl.startsWith('cached:')) {
      const cached = memoryCache.get(m.id);
      return cached ? { ...m, dataUrl: cached } : m;
    }
    return m;
  });
}

/**
 * Hydrate memory cache from IndexedDB for all "cached:" entries.
 * Call once on component mount.
 */
export async function hydrateMediaCache<T extends { id: string; dataUrl: string }>(entries: T[]): Promise<void> {
  const cached = entries.filter((m) => m.dataUrl.startsWith('cached:'));
  if (cached.length === 0) return;
  await Promise.all(cached.map((m) => loadFromDB(m.id)));
}
