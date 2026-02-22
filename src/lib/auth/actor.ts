import 'server-only';

import { auth } from '@clerk/nextjs/server';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getDatabaseAsync } from '@/lib/db';
import { users, workspaceMembers, workspaces } from '@/lib/db/schema';

export async function requireActor() {
  const session = await auth();

  if (!session.userId) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  const db = await getDatabaseAsync();
  const [user] = await db.select().from(users).where(eq(users.clerkUserId, session.userId));

  if (!user) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: 'User not provisioned yet. Retry after Clerk webhook sync.' },
        { status: 409 }
      ),
    };
  }

  const memberships = await db
    .select()
    .from(workspaceMembers)
    .where(eq(workspaceMembers.userId, user.id));

  return {
    ok: true as const,
    actor: {
      clerkUserId: session.userId,
      user,
      memberships,
      workspaceIds: memberships.map((membership: { workspaceId: string }) => membership.workspaceId),
    },
  };
}

export async function resolveDefaultWorkspaceId(userId: string) {
  const db = await getDatabaseAsync();

  const [personalWorkspace] = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.ownerUserId, userId));

  return personalWorkspace?.id ?? null;
}
