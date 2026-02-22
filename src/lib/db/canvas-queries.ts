import 'server-only';

import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { getDatabaseAsync } from './index';
import { canvases } from './schema';
import type { CanvasMetadata, StoredCanvas } from '@/lib/storage/types';
import { normalizeStoredCanvas, resolveThumbnailStatus } from '@/lib/storage/types';

function parseJsonArray(value: string | null): unknown[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function listCanvasesForWorkspaces(workspaceIds: string[]): Promise<CanvasMetadata[]> {
  if (workspaceIds.length === 0) return [];

  const db = await getDatabaseAsync();
  const rows = await db
    .select()
    .from(canvases)
    .where(inArray(canvases.workspaceId, workspaceIds))
    .orderBy(desc(canvases.updatedAt));

  return rows.map((canvas: any) => {
    const nodes = parseJsonArray(canvas.nodes ?? null);
    const thumbnailUrl = canvas.thumbnailUrl || canvas.thumbnail || undefined;
    const thumbnailStatus = resolveThumbnailStatus(canvas.thumbnailStatus || undefined, thumbnailUrl);

    return {
      id: canvas.id,
      name: canvas.name,
      workspaceId: canvas.workspaceId || undefined,
      thumbnail: canvas.thumbnail || thumbnailUrl,
      thumbnailUrl,
      thumbnailStatus,
      thumbnailUpdatedAt: canvas.thumbnailUpdatedAt instanceof Date
        ? canvas.thumbnailUpdatedAt.getTime()
        : canvas.thumbnailUpdatedAt || undefined,
      thumbnailVersion: canvas.thumbnailVersion || undefined,
      thumbnailErrorCode: canvas.thumbnailErrorCode || undefined,
      createdAt: canvas.createdAt instanceof Date ? canvas.createdAt.getTime() : canvas.createdAt,
      updatedAt: canvas.updatedAt instanceof Date ? canvas.updatedAt.getTime() : canvas.updatedAt,
      nodeCount: nodes.length,
    };
  });
}

export async function getCanvasByIdForWorkspaces(id: string, workspaceIds: string[]): Promise<StoredCanvas | null> {
  if (workspaceIds.length === 0) return null;

  const db = await getDatabaseAsync();
  const [canvas] = await db
    .select()
    .from(canvases)
    .where(and(eq(canvases.id, id), inArray(canvases.workspaceId, workspaceIds)));

  if (!canvas) return null;

  return normalizeStoredCanvas({
    id: canvas.id,
    name: canvas.name,
    thumbnail: canvas.thumbnail || undefined,
    thumbnailUrl: canvas.thumbnailUrl || undefined,
    thumbnailStatus: canvas.thumbnailStatus || undefined,
    thumbnailUpdatedAt: canvas.thumbnailUpdatedAt instanceof Date
      ? canvas.thumbnailUpdatedAt.getTime()
      : canvas.thumbnailUpdatedAt || undefined,
    thumbnailVersion: canvas.thumbnailVersion || undefined,
    thumbnailErrorCode: canvas.thumbnailErrorCode || undefined,
    createdAt: canvas.createdAt instanceof Date ? canvas.createdAt.getTime() : canvas.createdAt,
    updatedAt: canvas.updatedAt instanceof Date ? canvas.updatedAt.getTime() : canvas.updatedAt,
    nodes: parseJsonArray(canvas.nodes ?? null) as StoredCanvas['nodes'],
    edges: parseJsonArray(canvas.edges ?? null) as StoredCanvas['edges'],
  });
}

export async function upsertWorkspaceCanvas(
  workspaceId: string,
  ownerUserId: string,
  canvas: StoredCanvas & { projectId?: string | null }
) {
  const db = await getDatabaseAsync();
  const normalized = normalizeStoredCanvas(canvas);
  const now = new Date();

  await db
    .insert(canvases)
    .values({
      id: normalized.id,
      workspaceId,
      ownerUserId,
      projectId: canvas.projectId ?? null,
      name: normalized.name,
      nodes: JSON.stringify(normalized.nodes || []),
      edges: JSON.stringify(normalized.edges || []),
      thumbnail: normalized.thumbnail || null,
      thumbnailUrl: normalized.thumbnailUrl || null,
      thumbnailStatus: normalized.thumbnailStatus || 'empty',
      thumbnailUpdatedAt: normalized.thumbnailUpdatedAt ? new Date(normalized.thumbnailUpdatedAt) : null,
      thumbnailVersion: normalized.thumbnailVersion || null,
      thumbnailErrorCode: normalized.thumbnailErrorCode || null,
      createdAt: new Date(normalized.createdAt),
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: canvases.id,
      set: {
        workspaceId,
        ownerUserId,
        projectId: canvas.projectId ?? null,
        name: normalized.name,
        nodes: JSON.stringify(normalized.nodes || []),
        edges: JSON.stringify(normalized.edges || []),
        thumbnail: normalized.thumbnail || null,
        thumbnailUrl: normalized.thumbnailUrl || null,
        thumbnailStatus: normalized.thumbnailStatus || 'empty',
        thumbnailUpdatedAt: normalized.thumbnailUpdatedAt ? new Date(normalized.thumbnailUpdatedAt) : null,
        thumbnailVersion: normalized.thumbnailVersion || null,
        thumbnailErrorCode: normalized.thumbnailErrorCode || null,
        updatedAt: now,
      },
    });
}

export async function getCanvasWorkspaceIdForWorkspaces(id: string, workspaceIds: string[]) {
  if (workspaceIds.length === 0) return null;

  const db = await getDatabaseAsync();
  const [row] = await db
    .select({ workspaceId: canvases.workspaceId })
    .from(canvases)
    .where(and(eq(canvases.id, id), inArray(canvases.workspaceId, workspaceIds)));

  return row?.workspaceId ?? null;
}

export async function deleteCanvasByIdForWorkspace(id: string, workspaceId: string) {
  const db = await getDatabaseAsync();
  await db.delete(canvases).where(and(eq(canvases.id, id), eq(canvases.workspaceId, workspaceId)));
}

export async function listLegacyCanvases() {
  const db = await getDatabaseAsync();
  return db.select().from(canvases).where(isNull(canvases.workspaceId));
}
