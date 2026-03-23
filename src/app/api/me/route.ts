import 'server-only';

import { NextResponse } from 'next/server';
import { requireActor } from '@/lib/auth/actor';

export async function GET() {
  const actorResult = await requireActor();
  if (!actorResult.ok) return actorResult.response;

  const { user, memberships } = actorResult.actor;

  return NextResponse.json({
    user: {
      id: user.id,
      clerkUserId: user.clerkUserId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      imageUrl: user.imageUrl,
    },
    memberships,
  });
}
