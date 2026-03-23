import 'server-only';

import { randomUUID } from 'crypto';
import { and, eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { requireActor } from '@/lib/auth/actor';
import { getCanvasWorkspaceIdForWorkspaces } from '@/lib/db/canvas-queries';
import { getDatabaseAsync } from '@/lib/db';
import { canvasShares } from '@/lib/db/schema';
import { can, type WorkspaceRole } from '@/lib/permissions/matrix';
import { logAuditEvent } from '@/lib/audit/log';

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteParams) {
  const actorResult = await requireActor();
  if (!actorResult.ok) return actorResult.response;

  const { id } = await params;
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

  if (!can(membership.role as WorkspaceRole, 'share')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const granteeType = (body.granteeType as 'user' | 'link' | undefined) ?? 'user';
  const granteeId = body.granteeId as string | undefined;
  const permission = (body.permission as 'view' | 'edit' | undefined) ?? 'view';

  if (!granteeId) {
    return NextResponse.json({ error: 'granteeId is required' }, { status: 400 });
  }

  const db = await getDatabaseAsync();
  await db
    .insert(canvasShares)
    .values({
      id: randomUUID(),
      workspaceId,
      canvasId: id,
      granteeType,
      granteeId,
      permission,
      createdByUserId: actorResult.actor.user.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [canvasShares.canvasId, canvasShares.granteeType, canvasShares.granteeId],
      set: {
        permission,
        updatedAt: new Date(),
      },
    });

  await logAuditEvent({
    workspaceId,
    actorUserId: actorResult.actor.user.id,
    action: 'canvas.share',
    targetType: 'canvas',
    targetId: id,
    metadata: { granteeType, granteeId, permission },
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const actorResult = await requireActor();
  if (!actorResult.ok) return actorResult.response;

  const { id } = await params;
  const workspaceId = await getCanvasWorkspaceIdForWorkspaces(id, actorResult.actor.workspaceIds);

  if (!workspaceId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const membership = actorResult.actor.memberships.find(
    (item: { workspaceId: string; role: string }) => item.workspaceId === workspaceId
  );

  if (!membership || !can(membership.role as WorkspaceRole, 'share')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const granteeType = (request.nextUrl.searchParams.get('granteeType') as 'user' | 'link' | null) ?? 'user';
  const granteeId = request.nextUrl.searchParams.get('granteeId');

  if (!granteeId) {
    return NextResponse.json({ error: 'granteeId is required' }, { status: 400 });
  }

  const db = await getDatabaseAsync();
  await db
    .delete(canvasShares)
    .where(
      and(
        eq(canvasShares.canvasId, id),
        eq(canvasShares.workspaceId, workspaceId),
        eq(canvasShares.granteeType, granteeType),
        eq(canvasShares.granteeId, granteeId)
      )
    );

  await logAuditEvent({
    workspaceId,
    actorUserId: actorResult.actor.user.id,
    action: 'canvas.unshare',
    targetType: 'canvas',
    targetId: id,
    metadata: { granteeType, granteeId },
  });

  return NextResponse.json({ success: true });
}
