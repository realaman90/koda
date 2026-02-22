import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { requireActor } from '@/lib/auth/actor';
import {
  deleteCanvasByIdForWorkspace,
  getCanvasByIdForWorkspaces,
  getCanvasWorkspaceIdForWorkspaces,
  upsertWorkspaceCanvas,
} from '@/lib/db/canvas-queries';
import { can, type WorkspaceRole } from '@/lib/permissions/matrix';
import { logAuditEvent } from '@/lib/audit/log';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const actorResult = await requireActor();
  if (!actorResult.ok) return actorResult.response;

  const { id } = await params;

  try {
    const canvas = await getCanvasByIdForWorkspaces(id, actorResult.actor.workspaceIds);

    if (!canvas) {
      return NextResponse.json({ error: 'Canvas not found' }, { status: 404 });
    }

    return NextResponse.json({ canvas, backend: 'sqlite' });
  } catch (error) {
    console.error('Failed to get canvas:', error);
    return NextResponse.json(
      { error: 'Failed to get canvas', details: String(error) },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const actorResult = await requireActor();
  if (!actorResult.ok) return actorResult.response;

  const { id } = await params;

  try {
    const existing = await getCanvasByIdForWorkspaces(id, actorResult.actor.workspaceIds);

    if (!existing) {
      return NextResponse.json({ error: 'Canvas not found' }, { status: 404 });
    }

    const body = await request.json();
    const {
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
      projectId,
    } = body;

    const mergedCanvas = {
      id,
      name: name ?? existing.name ?? 'Untitled',
      nodes: nodes ?? existing.nodes ?? [],
      edges: edges ?? existing.edges ?? [],
      thumbnail: thumbnail ?? existing.thumbnail,
      thumbnailUrl: thumbnailUrl ?? existing.thumbnailUrl,
      thumbnailStatus: thumbnailStatus ?? existing.thumbnailStatus,
      thumbnailUpdatedAt: thumbnailUpdatedAt ?? existing.thumbnailUpdatedAt,
      thumbnailVersion: thumbnailVersion ?? existing.thumbnailVersion,
      thumbnailErrorCode: thumbnailErrorCode ?? existing.thumbnailErrorCode,
      createdAt: createdAt ?? existing.createdAt ?? Date.now(),
      updatedAt: updatedAt ?? Date.now(),
      projectId: projectId ?? null,
    };

    const workspaceId = await getCanvasWorkspaceIdForWorkspaces(id, actorResult.actor.workspaceIds);

    if (!workspaceId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const membership = actorResult.actor.memberships.find(
      (item: { workspaceId: string; role: string }) => item.workspaceId === workspaceId
    );

    if (!membership) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (!can(membership.role as WorkspaceRole, 'edit')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await upsertWorkspaceCanvas(workspaceId, actorResult.actor.user.id, mergedCanvas);
    await logAuditEvent({
      workspaceId,
      actorUserId: actorResult.actor.user.id,
      action: 'canvas.update',
      targetType: 'canvas',
      targetId: id,
      metadata: { projectId: projectId ?? null },
    });

    return NextResponse.json({ success: true, canvas: mergedCanvas });
  } catch (error) {
    console.error('Failed to update canvas:', error);
    return NextResponse.json(
      { error: 'Failed to update canvas', details: String(error) },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const actorResult = await requireActor();
  if (!actorResult.ok) return actorResult.response;

  const { id } = await params;

  try {
    const canvas = await getCanvasByIdForWorkspaces(id, actorResult.actor.workspaceIds);

    if (!canvas) {
      return NextResponse.json({ error: 'Canvas not found' }, { status: 404 });
    }

    const workspaceId = await getCanvasWorkspaceIdForWorkspaces(id, actorResult.actor.workspaceIds);
    if (!workspaceId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const membership = actorResult.actor.memberships.find(
      (item: { workspaceId: string; role: string }) => item.workspaceId === workspaceId
    );

    if (!membership) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (!can(membership.role as WorkspaceRole, 'delete')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await deleteCanvasByIdForWorkspace(id, workspaceId);
    await logAuditEvent({
      workspaceId,
      actorUserId: actorResult.actor.user.id,
      action: 'canvas.delete',
      targetType: 'canvas',
      targetId: id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete canvas:', error);
    return NextResponse.json(
      { error: 'Failed to delete canvas', details: String(error) },
      { status: 500 }
    );
  }
}
