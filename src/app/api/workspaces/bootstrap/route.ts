import 'server-only';

import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireActor } from '@/lib/auth/actor';
import { getDatabaseAsync } from '@/lib/db';
import { workspaceInvites, workspaceMembers, workspaces } from '@/lib/db/schema';
import { isWorkspacesV1Enabled } from '@/lib/flags';
import { emitLaunchMetric } from '@/lib/observability/launch-metrics';

function parseBootstrapAttempt(request: Request): number {
  const rawAttempt = request.headers.get('x-workspace-bootstrap-attempt');
  const parsed = Number.parseInt(rawAttempt ?? '', 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1;
  }
  return parsed;
}

function retryOutcome(attempt: number, status: 'success' | 'error'): 'not_needed' | 'recovered' | 'initial_failed' | 'retry_failed' {
  if (status === 'success') {
    return attempt > 1 ? 'recovered' : 'not_needed';
  }

  return attempt > 1 ? 'retry_failed' : 'initial_failed';
}

export async function POST(request: Request) {
  const attempt = parseBootstrapAttempt(request);

  try {
    if (!isWorkspacesV1Enabled()) {
      emitLaunchMetric({
        metric: 'workspace_bootstrap',
        status: 'error',
        source: 'api',
        errorCode: 'feature_disabled',
        metadata: {
          errorClass: 'feature_gate',
          attempt,
          retryOutcome: retryOutcome(attempt, 'error'),
        },
      });
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const actorResult = await requireActor();
    if (!actorResult.ok) {
      emitLaunchMetric({
        metric: 'workspace_bootstrap',
        status: 'error',
        source: 'api',
        errorCode: 'auth_required',
        metadata: {
          errorClass: 'auth',
          attempt,
          retryOutcome: retryOutcome(attempt, 'error'),
        },
      });
      return actorResult.response;
    }

    const db = await getDatabaseAsync();

    let personalWorkspace = actorResult.actor.memberships.find(
      (membership: { role: string; workspaceId: string }) => membership.role === 'owner'
    );
    let createdPersonalWorkspace = false;

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
      createdPersonalWorkspace = true;
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

    emitLaunchMetric({
      metric: 'workspace_bootstrap',
      status: 'success',
      source: 'api',
      metadata: {
        userId: actorResult.actor.user.id,
        memberships: memberships.length,
        invites: invites.length,
        attempt,
        retryOutcome: retryOutcome(attempt, 'success'),
      },
    });

    if (createdPersonalWorkspace) {
      emitLaunchMetric({
        metric: 'activation_first_workspace',
        status: 'success',
        source: 'api',
        metadata: {
          userId: actorResult.actor.user.id,
          workspaceId: personalWorkspace.workspaceId,
        },
      });
    }

    return NextResponse.json({
      memberships,
      invites,
      personalWorkspaceId: personalWorkspace.workspaceId,
    });
  } catch (error) {
    emitLaunchMetric({
      metric: 'workspace_bootstrap',
      status: 'error',
      source: 'api',
      errorCode: 'bootstrap_exception',
      metadata: {
        errorClass: 'exception',
        attempt,
        retryOutcome: retryOutcome(attempt, 'error'),
        message: error instanceof Error ? error.message : String(error),
      },
    });

    return NextResponse.json(
      { error: 'Failed to bootstrap workspace' },
      { status: 500 }
    );
  }
}
