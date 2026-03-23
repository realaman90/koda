/**
 * SQLite Storage Provider
 * 
 * SERVER-ONLY: This module uses Node.js APIs and should only be
 * imported from server-side code (API routes).
 */
import 'server-only';

import { eq, desc } from 'drizzle-orm';
import type { StorageProvider, StoredCanvas, CanvasMetadata } from './types';

// Dynamic import helper for database
async function getDb() {
  const { getDatabaseAsync } = await import('../db');
  return getDatabaseAsync();
}

async function getCanvasesTable() {
  const { canvases } = await import('../db/schema');
  return canvases;
}

/**
 * SQLite implementation of StorageProvider
 * Uses Drizzle ORM with libSQL (local SQLite or Turso cloud)
 * 
 * Stores nodes and edges as JSON blobs for simplicity
 */
export class SQLiteStorageProvider implements StorageProvider {
  
  async listCanvases(): Promise<CanvasMetadata[]> {
    const db = await getDb() as any;
    const canvases = await getCanvasesTable();
    
    const results = await db
      .select()
      .from(canvases)
      .orderBy(desc(canvases.updatedAt));

    return results.map((canvas: any) => {
      // Parse nodes to get count
      let nodeCount = 0;
      try {
        const nodes = canvas.nodes ? JSON.parse(canvas.nodes) : [];
        nodeCount = Array.isArray(nodes) ? nodes.length : 0;
      } catch {
        // Invalid JSON, default to 0
      }
      
      return {
        id: canvas.id,
        name: canvas.name,
        thumbnail: canvas.thumbnail || undefined,
        createdAt: canvas.createdAt instanceof Date ? canvas.createdAt.getTime() : canvas.createdAt,
        updatedAt: canvas.updatedAt instanceof Date ? canvas.updatedAt.getTime() : canvas.updatedAt,
        nodeCount,
      };
    });
  }

  async getCanvas(id: string): Promise<StoredCanvas | null> {
    const db = await getDb() as any;
    const canvases = await getCanvasesTable();
    
    const [canvas] = await db
      .select()
      .from(canvases)
      .where(eq(canvases.id, id));

    if (!canvas) return null;

    // Parse JSON blobs
    let nodes = [];
    let edges = [];
    
    try {
      nodes = canvas.nodes ? JSON.parse(canvas.nodes) : [];
    } catch {
      console.error(`Failed to parse nodes for canvas ${id}`);
    }
    
    try {
      edges = canvas.edges ? JSON.parse(canvas.edges) : [];
    } catch {
      console.error(`Failed to parse edges for canvas ${id}`);
    }

    return {
      id: canvas.id,
      name: canvas.name,
      thumbnail: canvas.thumbnail || undefined,
      createdAt: canvas.createdAt instanceof Date ? canvas.createdAt.getTime() : canvas.createdAt,
      updatedAt: canvas.updatedAt instanceof Date ? canvas.updatedAt.getTime() : canvas.updatedAt,
      nodes,
      edges,
    };
  }

  async saveCanvas(canvas: StoredCanvas): Promise<void> {
    const db = await getDb() as any;
    const canvases = await getCanvasesTable();
    const now = new Date();

    // Serialize nodes and edges to JSON
    const nodesJson = JSON.stringify(canvas.nodes || []);
    const edgesJson = JSON.stringify(canvas.edges || []);

    // Upsert: insert or update on conflict
    await db
      .insert(canvases)
      .values({
        id: canvas.id,
        name: canvas.name,
        nodes: nodesJson,
        edges: edgesJson,
        thumbnail: canvas.thumbnail || null,
        createdAt: new Date(canvas.createdAt),
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: canvases.id,
        set: {
          name: canvas.name,
          nodes: nodesJson,
          edges: edgesJson,
          thumbnail: canvas.thumbnail || null,
          updatedAt: now,
        },
      });
  }

  async deleteCanvas(id: string): Promise<void> {
    const db = await getDb() as any;
    const canvases = await getCanvasesTable();
    await db.delete(canvases).where(eq(canvases.id, id));
  }

  async canvasExists(id: string): Promise<boolean> {
    const db = await getDb() as any;
    const canvases = await getCanvasesTable();
    
    const [result] = await db
      .select({ id: canvases.id })
      .from(canvases)
      .where(eq(canvases.id, id));
    
    return !!result;
  }

  /**
   * Migrate data from localStorage provider
   * Useful for users upgrading from localStorage to SQLite
   */
  async migrateFromLocalStorage(localStorageProvider: StorageProvider): Promise<number> {
    const canvasList = await localStorageProvider.listCanvases();
    let migrated = 0;

    for (const meta of canvasList) {
      // Check if canvas already exists in SQLite
      const exists = await this.canvasExists(meta.id);
      if (exists) continue;

      // Get full canvas data
      const canvas = await localStorageProvider.getCanvas(meta.id);
      if (canvas) {
        await this.saveCanvas(canvas);
        migrated++;
      }
    }

    return migrated;
  }
}

// Singleton instance
let instance: SQLiteStorageProvider | null = null;

export function getSQLiteStorageProvider(): SQLiteStorageProvider {
  if (!instance) {
    instance = new SQLiteStorageProvider();
  }
  return instance;
}
