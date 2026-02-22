import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { inArray } from 'drizzle-orm';
import { requireActor, resolveDefaultWorkspaceId } from '@/lib/auth/actor';
import { listCanvasesForWorkspaces, upsertWorkspaceCanvas } from '@/lib/db/canvas-queries';
import { getDatabaseAsync } from '@/lib/db';
import { canvasShares, workspaces } from '@/lib/db/schema';
import { can, type WorkspaceRole } from '@/lib/permissions/matrix';
import { logAuditEvent } from '@/lib/audit/log';

export async function GET() {
  const actorResult = await requireActor();
  if (!actorResult.ok) return actorResult.response;

  const canvases = await listCanvasesForWorkspaces(actorResult.actor.workspaceIds);

  const db = await getDatabaseAsync();
  const workspaceRows = actorResult.actor.workspaceIds.length
    ? await db
        .select({ id: workspaces.id, type: workspaces.type })
        .from(workspaces)
        .where(inArray(workspaces.id, actorResult.actor.workspaceIds))
    : [];
  const workspaceTypeById = new Map(workspaceRows.map((row: { id: string; type: string }) => [row.id, row.type]));

  const shareRows = canvases.length
    ? await db
        .select({ canvasId: canvasShares.canvasId })
        .from(canvasShares)
        .where(inArray(canvasShares.canvasId, canvases.map((canvas) => canvas.id)))
    : [];
  const sharedCanvasIds = new Set(shareRows.map((row: { canvasId: string }) => row.canvasId));

  const enriched = canvases.map((canvas) => {
    const membership = actorResult.actor.memberships.find(
      (item: { workspaceId: string; role: string }) => item.workspaceId === canvas.workspaceId
    );

    return {
      ...canvas,
      workspaceType: (canvas.workspaceId && workspaceTypeById.get(canvas.workspaceId)) || 'personal',
      accessRole: (membership?.role as WorkspaceRole | undefined) || 'viewer',
      isShared: sharedCanvasIds.has(canvas.id),
    };
  });

  return NextResponse.json({ canvases: enriched, backend: 'sqlite' });
}

export async function POST(request: NextRequest) {
  const actorResult = await requireActor();
  if (!actorResult.ok) return actorResult.response;

  try {
    const body = await request.json();
    const {
      id,
      name,
      nodes,
      edges,
      thumbnail,
      thumbnailUrl,
      thumbnailStatus,
      thumbnailUpdatedAt,
      thumbnailVersion,
      thumbnailErrorCode,
      createdAt,
      updatedAt,
      workspaceId,
      projectId,
    } = body;

    if (!id || !name) {
      return NextResponse.json({ error: 'Missing required fields: id, name' }, { status: 400 });
    }

    const targetWorkspaceId =
      workspaceId || (await resolveDefaultWorkspaceId(actorResult.actor.user.id));

    if (!targetWorkspaceId) {
      return NextResponse.json({ error: 'No workspace available for actor' }, { status: 409 });
    }

    const membership = actorResult.actor.memberships.find(
      (item: { workspaceId: string; role: string }) => item.workspaceId === targetWorkspaceId
    );

    if (!membership) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (!can(membership.role as WorkspaceRole, 'create')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const canvas = {
      id,
      name,
      nodes: nodes || [],
      edges: edges || [],
      thumbnail,
      thumbnailUrl,
      thumbnailStatus,
      thumbnailUpdatedAt,
      thumbnailVersion,
      thumbnailErrorCode,
      createdAt: createdAt || Date.now(),
      updatedAt: updatedAt || Date.now(),
      projectId: projectId || null,
    };

    await upsertWorkspaceCanvas(targetWorkspaceId, actorResult.actor.user.id, canvas);
    await logAuditEvent({
      workspaceId: targetWorkspaceId,
      actorUserId: actorResult.actor.user.id,
      action: 'canvas.create',
      targetType: 'canvas',
      targetId: id,
      metadata: { projectId: projectId || null },
    });

    return NextResponse.json({ success: true, canvas: { ...canvas, workspaceId: targetWorkspaceId } });
  } catch (error) {
    console.error('Failed to create canvas:', error);
    return NextResponse.json(
      { error: 'Failed to create canvas', details: String(error) },
      { status: 500 }
    );
  }
}
