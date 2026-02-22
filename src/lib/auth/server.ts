import 'server-only';

import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

export async function getAuthContext() {
  const authState = await auth();
  return { userId: authState.userId, sessionId: authState.sessionId };
}

export async function requireUserId() {
  const { userId } = await getAuthContext();

  if (!userId) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  return { ok: true as const, userId };
}
