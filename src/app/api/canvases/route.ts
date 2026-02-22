import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { requireActor, resolveDefaultWorkspaceId } from '@/lib/auth/actor';
import { listCanvasesForWorkspaces, upsertWorkspaceCanvas } from '@/lib/db/canvas-queries';
import { can, type WorkspaceRole } from '@/lib/permissions/matrix';
import { logAuditEvent } from '@/lib/audit/log';

export async function GET() {
  const actorResult = await requireActor();
  if (!actorResult.ok) return actorResult.response;

  const canvases = await listCanvasesForWorkspaces(actorResult.actor.workspaceIds);
  return NextResponse.json({ canvases, backend: 'sqlite' });
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
