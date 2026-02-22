import 'server-only';

import { randomUUID } from 'crypto';
import { and, eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { requireActor } from '@/lib/auth/actor';
import { requireWorkspaceActor } from '@/lib/auth/workspace';
import { getDatabaseAsync } from '@/lib/db';
import { workspaceInvites, workspaceMembers } from '@/lib/db/schema';
import { logAuditEvent } from '@/lib/audit/log';
import { isCollabSharingV1Enabled, isWorkspacesV1Enabled } from '@/lib/flags';

type RouteParams = { params: Promise<{ token: string }> };

function isExpired(expiresAt: Date | number | null | undefined) {
  if (!expiresAt) return false;
  const ts = expiresAt instanceof Date ? expiresAt.getTime() : Number(expiresAt);
  return ts <= Date.now();
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  if (!isWorkspacesV1Enabled() || !isCollabSharingV1Enabled()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { token } = await params;
  const { action } = await request.json();

  if (!['accept', 'decline', 'revoke'].includes(action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  const db = await getDatabaseAsync();
  const [invite] = await db.select().from(workspaceInvites).where(eq(workspaceInvites.token, token));

  if (!invite) {
    return NextResponse.json({ error: 'Invalid invite token' }, { status: 404 });
  }

  if (invite.status === 'revoked') {
    return NextResponse.json({ error: 'Invite revoked' }, { status: 400 });
  }

  if (invite.status === 'declined') {
    return NextResponse.json({ error: 'Invite declined' }, { status: 400 });
  }

  if (isExpired(invite.expiresAt)) {
    if (invite.status === 'pending') {
      await db
        .update(workspaceInvites)
        .set({ status: 'expired', updatedAt: new Date() })
        .where(eq(workspaceInvites.id, invite.id));
    }
    return NextResponse.json({ error: 'Invite expired' }, { status: 400 });
  }

  if (action === 'revoke') {
    const workspaceActor = await requireWorkspaceActor(invite.workspaceId);
    if (!workspaceActor.ok) return workspaceActor.response;

    if (!['owner', 'admin'].includes(workspaceActor.membership.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await db
      .update(workspaceInvites)
      .set({ status: 'revoked', revokedAt: new Date(), updatedAt: new Date() })
      .where(eq(workspaceInvites.id, invite.id));

    await logAuditEvent({
      workspaceId: invite.workspaceId,
      actorUserId: workspaceActor.actor.user.id,
      action: 'invite.revoke',
      targetType: 'invite',
      targetId: invite.id,
      metadata: { email: invite.email },
    });

    return NextResponse.json({ success: true, status: 'revoked' });
  }

  const actorResult = await requireActor();
  if (!actorResult.ok) return actorResult.response;

  if (invite.email.toLowerCase() !== actorResult.actor.user.email.toLowerCase()) {
    return NextResponse.json({ error: 'Invite recipient mismatch' }, { status: 403 });
  }

  if (action === 'decline') {
    if (invite.status === 'declined') {
      return NextResponse.json({ success: true, idempotent: true, status: 'declined' });
    }

    await db
      .update(workspaceInvites)
      .set({ status: 'declined', updatedAt: new Date() })
      .where(eq(workspaceInvites.id, invite.id));

    await logAuditEvent({
      workspaceId: invite.workspaceId,
      actorUserId: actorResult.actor.user.id,
      action: 'invite.decline',
      targetType: 'invite',
      targetId: invite.id,
    });

    return NextResponse.json({ success: true, status: 'declined' });
  }

  // accept
  if (invite.status === 'accepted') {
    return NextResponse.json({ success: true, idempotent: true, status: 'accepted' });
  }

  await db.transaction(async (tx: any) => {
    await tx
      .insert(workspaceMembers)
      .values({
        id: randomUUID(),
        workspaceId: invite.workspaceId,
        userId: actorResult.actor.user.id,
        role: invite.role,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoNothing({ target: [workspaceMembers.workspaceId, workspaceMembers.userId] });

    await tx
      .update(workspaceInvites)
      .set({ status: 'accepted', acceptedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(workspaceInvites.id, invite.id), eq(workspaceInvites.status, 'pending')));
  });

  await logAuditEvent({
    workspaceId: invite.workspaceId,
    actorUserId: actorResult.actor.user.id,
    action: 'invite.accept',
    targetType: 'invite',
    targetId: invite.id,
    metadata: { role: invite.role },
  });

  return NextResponse.json({ success: true, status: 'accepted' });
}
