import 'server-only';

import { and, eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { requireWorkspaceActor } from '@/lib/auth/workspace';
import { getDatabaseAsync } from '@/lib/db';
import { workspaceMembers, workspaces } from '@/lib/db/schema';
import { can, type WorkspaceRole } from '@/lib/permissions/matrix';
import { logAuditEvent } from '@/lib/audit/log';

type RouteParams = { params: Promise<{ workspaceId: string }> };

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { workspaceId } = await params;
  const workspaceActor = await requireWorkspaceActor(workspaceId);
  if (!workspaceActor.ok) return workspaceActor.response;

  if (!can(workspaceActor.membership.role as WorkspaceRole, 'ownership-transfer')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { targetMemberId } = await request.json();
  if (!targetMemberId) {
    return NextResponse.json({ error: 'targetMemberId is required' }, { status: 400 });
  }

  const db = await getDatabaseAsync();
  const [targetMember] = await db
    .select()
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.id, targetMemberId), eq(workspaceMembers.workspaceId, workspaceId)));

  if (!targetMember) {
    return NextResponse.json({ error: 'Target member not found' }, { status: 404 });
  }

  await db.transaction(async (tx: any) => {
    await tx
      .update(workspaces)
      .set({ ownerUserId: targetMember.userId, updatedAt: new Date() })
      .where(eq(workspaces.id, workspaceId));

    await tx
      .update(workspaceMembers)
      .set({ role: 'owner', updatedAt: new Date() })
      .where(eq(workspaceMembers.id, targetMember.id));

    await tx
      .update(workspaceMembers)
      .set({ role: 'admin', updatedAt: new Date() })
      .where(eq(workspaceMembers.id, workspaceActor.membership.id));
  });

  await logAuditEvent({
    workspaceId,
    actorUserId: workspaceActor.actor.user.id,
    action: 'workspace.transfer_ownership',
    targetType: 'workspace',
    targetId: workspaceId,
    metadata: {
      previousOwnerMemberId: workspaceActor.membership.id,
      newOwnerMemberId: targetMember.id,
      newOwnerUserId: targetMember.userId,
    },
  });

  return NextResponse.json({ success: true });
}
