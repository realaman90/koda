import 'server-only';

import { randomBytes, randomUUID } from 'crypto';
import { and, eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { requireWorkspaceActor } from '@/lib/auth/workspace';
import { getDatabaseAsync } from '@/lib/db';
import { workspaceInvites } from '@/lib/db/schema';
import { can, type WorkspaceRole } from '@/lib/permissions/matrix';
import { logAuditEvent } from '@/lib/audit/log';

export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get('workspaceId');
  if (!workspaceId) {
    return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });
  }

  const workspaceActor = await requireWorkspaceActor(workspaceId);
  if (!workspaceActor.ok) return workspaceActor.response;

  const db = await getDatabaseAsync();
  const invites = await db
    .select()
    .from(workspaceInvites)
    .where(eq(workspaceInvites.workspaceId, workspaceId));

  return NextResponse.json({ invites });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const workspaceId = body.workspaceId as string | undefined;

  if (!workspaceId) {
    return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });
  }

  const workspaceActor = await requireWorkspaceActor(workspaceId);
  if (!workspaceActor.ok) return workspaceActor.response;

  if (!can(workspaceActor.membership.role as WorkspaceRole, 'invite')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const email = body.email as string | undefined;
  const role = (body.role as WorkspaceRole | undefined) || 'viewer';
  const expiresInDays = Number(body.expiresInDays ?? 7);

  if (!email) {
    return NextResponse.json({ error: 'email is required' }, { status: 400 });
  }

  const db = await getDatabaseAsync();
  const now = new Date();
  const token = `inv_${randomBytes(24).toString('hex')}`;

  const [existingPending] = await db
    .select()
    .from(workspaceInvites)
    .where(
      and(
        eq(workspaceInvites.workspaceId, workspaceId),
        eq(workspaceInvites.email, email),
        eq(workspaceInvites.status, 'pending')
      )
    );

  if (existingPending) {
    return NextResponse.json({ invite: existingPending, idempotent: true });
  }

  await db.insert(workspaceInvites).values({
    id: randomUUID(),
    workspaceId,
    email,
    role,
    status: 'pending',
    token,
    invitedByUserId: workspaceActor.actor.user.id,
    expiresAt: new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000),
    acceptedAt: null,
    revokedAt: null,
    createdAt: now,
    updatedAt: now,
  });

  const [invite] = await db
    .select()
    .from(workspaceInvites)
    .where(and(eq(workspaceInvites.workspaceId, workspaceId), eq(workspaceInvites.token, token)));

  await logAuditEvent({
    workspaceId,
    actorUserId: workspaceActor.actor.user.id,
    action: 'invite.create',
    targetType: 'invite',
    targetId: invite.id,
    metadata: { email, role },
  });

  return NextResponse.json({ invite });
}
