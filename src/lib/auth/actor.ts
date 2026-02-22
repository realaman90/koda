import 'server-only';

import { randomUUID } from 'crypto';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getDatabaseAsync } from '@/lib/db';
import { users, workspaceMembers, workspaces } from '@/lib/db/schema';

async function provisionUserFromClerk(clerkUserId: string): Promise<boolean> {
  try {
    const client = await clerkClient();
    const clerkUser = await client.users.getUser(clerkUserId);

    const primaryEmail = clerkUser.primaryEmailAddressId
      ? clerkUser.emailAddresses.find((email) => email.id === clerkUser.primaryEmailAddressId)?.emailAddress
      : clerkUser.emailAddresses[0]?.emailAddress;

    if (!primaryEmail) return false;

    const db = await getDatabaseAsync();
    const now = new Date();

    await db
      .insert(users)
      .values({
        id: randomUUID(),
        clerkUserId,
        email: primaryEmail,
        firstName: clerkUser.firstName ?? null,
        lastName: clerkUser.lastName ?? null,
        imageUrl: clerkUser.imageUrl ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: users.clerkUserId,
        set: {
          email: primaryEmail,
          firstName: clerkUser.firstName ?? null,
          lastName: clerkUser.lastName ?? null,
          imageUrl: clerkUser.imageUrl ?? null,
          updatedAt: now,
        },
      });

    return true;
  } catch (error) {
    console.error('Failed to provision user from Clerk:', error);
    return false;
  }
}

export async function requireActor() {
  const session = await auth();

  if (!session.userId) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  const db = await getDatabaseAsync();
  let [user] = await db.select().from(users).where(eq(users.clerkUserId, session.userId));

  if (!user) {
    const didProvision = await provisionUserFromClerk(session.userId);

    if (didProvision) {
      [user] = await db.select().from(users).where(eq(users.clerkUserId, session.userId));
    }
  }

  if (!user) {
    return {
      ok: false as const,
      response: NextResponse.json(
        {
          error:
            'User provisioning in progress. We could not sync your account yet—please retry in a few seconds.',
        },
        { status: 503 }
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
