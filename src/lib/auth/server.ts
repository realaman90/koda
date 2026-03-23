import 'server-only';

import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { isServerDevBypassAllowed, warnDevAuthBypassEnabled } from '@/lib/auth/dev-bypass';

const DEV_BYPASS_CLERK_USER_ID = '__dev_bypass_user__';

export async function getAuthContext() {
  const authState = await auth();

  if (authState.userId) {
    return { userId: authState.userId, sessionId: authState.sessionId };
  }

  if (await isServerDevBypassAllowed()) {
    warnDevAuthBypassEnabled('server-auth');
    return { userId: DEV_BYPASS_CLERK_USER_ID, sessionId: null };
  }

  return { userId: null, sessionId: authState.sessionId };
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
