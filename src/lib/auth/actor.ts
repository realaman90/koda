import 'server-only';

import { randomUUID } from 'crypto';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getDatabaseAsync } from '@/lib/db';
import { users, workspaceMembers, workspaces } from '@/lib/db/schema';
import { emitLaunchMetric } from '@/lib/observability/launch-metrics';

type ProvisioningFailureReason = 'missing_email' | 'clerk_lookup_failed' | 'db_upsert_failed';

type ProvisionUserResult =
  | { ok: true }
  | {
      ok: false;
      reason: ProvisioningFailureReason;
      retryable: boolean;
      message: string;
    };

const FALLBACK_PROVISION_MAX_ATTEMPTS = 2;
const FALLBACK_PROVISION_RETRY_DELAY_MS = 120;

function emitActorProvisioningEvent(event: {
  status: 'success' | 'error';
  event: string;
  clerkUserId: string;
  attempt?: number;
  reason?: ProvisioningFailureReason;
  message?: string;
}) {
  const payload = {
    ...event,
    ts: new Date().toISOString(),
  };

  const line = `[actor-provisioning] ${JSON.stringify(payload)}`;

  if (event.status === 'error') {
    console.error(line);
    return;
  }

  console.log(line);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function provisionUserFromClerk(clerkUserId: string): Promise<ProvisionUserResult> {
  const client = await clerkClient();
  let clerkUser;

  try {
    clerkUser = await client.users.getUser(clerkUserId);
  } catch (error) {
    return {
      ok: false,
      reason: 'clerk_lookup_failed',
      retryable: true,
      message: error instanceof Error ? error.message : String(error),
    };
  }

  const primaryEmail = clerkUser.primaryEmailAddressId
    ? clerkUser.emailAddresses.find((email) => email.id === clerkUser.primaryEmailAddressId)?.emailAddress
    : clerkUser.emailAddresses[0]?.emailAddress;

  if (!primaryEmail) {
    return {
      ok: false,
      reason: 'missing_email',
      retryable: false,
      message: 'Clerk user has no resolvable primary email.',
    };
  }

  const db = await getDatabaseAsync();
  const now = new Date();

  try {
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
  } catch (error) {
    return {
      ok: false,
      reason: 'db_upsert_failed',
      retryable: true,
      message: error instanceof Error ? error.message : String(error),
    };
  }

  return { ok: true };
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
    emitActorProvisioningEvent({
      status: 'success',
      event: 'fallback_started',
      clerkUserId: session.userId,
    });

    for (let attempt = 1; attempt <= FALLBACK_PROVISION_MAX_ATTEMPTS; attempt += 1) {
      const provisionResult = await provisionUserFromClerk(session.userId);

      if (provisionResult.ok) {
        [user] = await db.select().from(users).where(eq(users.clerkUserId, session.userId));

        emitActorProvisioningEvent({
          status: user ? 'success' : 'error',
          event: user ? 'fallback_succeeded' : 'fallback_upserted_but_missing_row',
          clerkUserId: session.userId,
          attempt,
          ...(user
            ? {}
            : {
                reason: 'db_upsert_failed',
                message: 'User row still missing after successful upsert.',
              }),
        });

        if (user) {
          emitLaunchMetric({
            metric: 'signup_completion',
            status: 'success',
            source: 'api',
            metadata: {
              clerkUserId: session.userId,
              fallbackProvisioning: true,
              attempt,
            },
          });
          break;
        }
      } else {
        emitActorProvisioningEvent({
          status: 'error',
          event: 'fallback_attempt_failed',
          clerkUserId: session.userId,
          attempt,
          reason: provisionResult.reason,
          message: provisionResult.message,
        });

        if (!provisionResult.retryable) {
          break;
        }
      }

      if (attempt < FALLBACK_PROVISION_MAX_ATTEMPTS) {
        await sleep(FALLBACK_PROVISION_RETRY_DELAY_MS * attempt);
      }
    }
  }

  if (!user) {
    emitLaunchMetric({
      metric: 'signup_completion',
      status: 'error',
      source: 'api',
      errorCode: 'fallback_actor_provisioning_failed',
      metadata: { clerkUserId: session.userId },
    });

    return {
      ok: false as const,
      response: NextResponse.json(
        {
          error:
            'User provisioning in progress. We could not sync your account yet—please retry in a few seconds.',
        },
        { status: 503, headers: { 'retry-after': '2' } }
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
