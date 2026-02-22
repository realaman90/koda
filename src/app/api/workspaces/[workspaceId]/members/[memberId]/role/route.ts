import 'server-only';

import { and, eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { requireWorkspaceActor } from '@/lib/auth/workspace';
import { getDatabaseAsync } from '@/lib/db';
import { workspaceMembers } from '@/lib/db/schema';
import { can, type WorkspaceRole } from '@/lib/permissions/matrix';
import { logAuditEvent } from '@/lib/audit/log';
import { isCollabSharingV1Enabled, isWorkspacesV1Enabled } from '@/lib/flags';

type RouteParams = {
  params: Promise<{ workspaceId: string; memberId: string }>;
};

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  if (!isWorkspacesV1Enabled() || !isCollabSharingV1Enabled()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { workspaceId, memberId } = await params;
  const workspaceActor = await requireWorkspaceActor(workspaceId);
  if (!workspaceActor.ok) return workspaceActor.response;

  if (!can(workspaceActor.membership.role as WorkspaceRole, 'role-change')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { role } = await request.json();
  const nextRole = role as WorkspaceRole;

  if (!['owner', 'admin', 'editor', 'viewer'].includes(nextRole)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
  }

  const db = await getDatabaseAsync();
  const [member] = await db
    .select()
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.id, memberId)));

  if (!member) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  await db
    .update(workspaceMembers)
    .set({ role: nextRole, updatedAt: new Date() })
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.id, memberId)));

  await logAuditEvent({
    workspaceId,
    actorUserId: workspaceActor.actor.user.id,
    action: 'member.role_change',
    targetType: 'workspace_member',
    targetId: memberId,
    metadata: { previousRole: member.role, nextRole },
  });

  return NextResponse.json({ success: true });
}
