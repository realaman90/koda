import 'server-only';

import { and, eq, lt } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireActor } from '@/lib/auth/actor';
import { getDatabaseAsync } from '@/lib/db';
import { workspaceInvites } from '@/lib/db/schema';

export async function POST() {
  const actorResult = await requireActor();
  if (!actorResult.ok) return actorResult.response;

  const db = await getDatabaseAsync();
  await db
    .update(workspaceInvites)
    .set({ status: 'expired', updatedAt: new Date() })
    .where(and(eq(workspaceInvites.status, 'pending'), lt(workspaceInvites.expiresAt, new Date())));

  return NextResponse.json({ success: true });
}
