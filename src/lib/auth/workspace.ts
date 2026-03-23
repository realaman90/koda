import 'server-only';

import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireActor } from './actor';
import { getDatabaseAsync } from '@/lib/db';
import { workspaceMembers } from '@/lib/db/schema';
import type { WorkspaceRole } from '@/lib/permissions/matrix';

export async function requireWorkspaceActor(workspaceId: string) {
  const actorResult = await requireActor();
  if (!actorResult.ok) return actorResult;

  const db = await getDatabaseAsync();
  const [membership] = await db
    .select()
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, actorResult.actor.user.id)
      )
    );

  if (!membership) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: 'Not found' }, { status: 404 }),
    };
  }

  return {
    ok: true as const,
    actor: actorResult.actor,
    membership: {
      ...membership,
      role: membership.role as WorkspaceRole,
    },
  };
}
