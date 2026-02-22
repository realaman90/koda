import 'server-only';

import { NextResponse } from 'next/server';
import { requireActor } from '@/lib/auth/actor';
import { isAuthV1Enabled, isWorkspacesV1Enabled } from '@/lib/flags';
import { resolveSyncCapability } from '@/lib/runtime/sync-capability';

function getConfiguredCanvasBackend(): 'localStorage' | 'sqlite' {
  return process.env.NEXT_PUBLIC_STORAGE_BACKEND === 'sqlite' ? 'sqlite' : 'localStorage';
}

async function extractErrorMessage(response: Response): Promise<string | undefined> {
  try {
    const payload = await response.clone().json();
    if (payload && typeof payload === 'object' && typeof (payload as { error?: unknown }).error === 'string') {
      return (payload as { error: string }).error;
    }
  } catch {
    // ignore parse errors
  }

  return undefined;
}

export async function GET() {
  const backend = getConfiguredCanvasBackend();
  const authV1Enabled = isAuthV1Enabled();
  const workspacesV1Enabled = isWorkspacesV1Enabled();

  if (backend !== 'sqlite' || !authV1Enabled || !workspacesV1Enabled) {
    return NextResponse.json(
      resolveSyncCapability({
        backend,
        authV1Enabled,
        workspacesV1Enabled,
      })
    );
  }

  const actorResult = await requireActor();
  if (!actorResult.ok) {
    const actorError = await extractErrorMessage(actorResult.response);

    return NextResponse.json(
      resolveSyncCapability({
        backend,
        authV1Enabled,
        workspacesV1Enabled,
        actorStatus: actorResult.response.status,
        actorError,
      })
    );
  }

  return NextResponse.json(
    resolveSyncCapability({
      backend,
      authV1Enabled,
      workspacesV1Enabled,
    })
  );
}
