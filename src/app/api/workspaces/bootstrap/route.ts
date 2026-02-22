import 'server-only';

import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireActor } from '@/lib/auth/actor';
import { getDatabaseAsync } from '@/lib/db';
import { workspaceInvites, workspaceMembers, workspaces } from '@/lib/db/schema';
import { isWorkspacesV1Enabled } from '@/lib/flags';

export async function POST() {
  if (!isWorkspacesV1Enabled()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const actorResult = await requireActor();
  if (!actorResult.ok) return actorResult.response;

  const db = await getDatabaseAsync();

  let personalWorkspace = actorResult.actor.memberships.find(
    (membership: { role: string; workspaceId: string }) => membership.role === 'owner'
  );

  if (!personalWorkspace) {
    const workspaceId = `ws_personal_${actorResult.actor.user.id}`;
    const now = new Date();

    await db.insert(workspaces).values({
      id: workspaceId,
      name: `${actorResult.actor.user.firstName || actorResult.actor.user.email.split('@')[0]}'s Workspace`,
      slug: null,
      type: 'personal',
      ownerUserId: actorResult.actor.user.id,
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(workspaceMembers).values({
      id: randomUUID(),
      workspaceId,
      userId: actorResult.actor.user.id,
      role: 'owner',
      createdAt: now,
      updatedAt: now,
    });

    personalWorkspace = { workspaceId, role: 'owner' };
  }

  const memberships = await db
    .select({
      workspaceId: workspaceMembers.workspaceId,
      role: workspaceMembers.role,
      workspaceName: workspaces.name,
      workspaceType: workspaces.type,
    })
    .from(workspaceMembers)
    .leftJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .where(eq(workspaceMembers.userId, actorResult.actor.user.id));

  const invites = await db
    .select()
    .from(workspaceInvites)
    .where(eq(workspaceInvites.email, actorResult.actor.user.email));

  return NextResponse.json({
    memberships,
    invites,
    personalWorkspaceId: personalWorkspace.workspaceId,
  });
}
