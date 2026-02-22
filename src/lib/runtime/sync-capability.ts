export type SyncCapabilityMode = 'local-only' | 'db-sync-available' | 'provisioning-blocked';

export interface SyncCapabilityProbe {
  mode: SyncCapabilityMode;
  backend: 'localStorage' | 'sqlite';
  message?: string;
  reason?: string;
}

interface SyncCapabilityInput {
  backend: 'localStorage' | 'sqlite';
  authV1Enabled: boolean;
  workspacesV1Enabled: boolean;
  actorStatus?: number;
  actorError?: string;
}

/**
 * Canonical runtime mode resolution for dashboard sync behavior.
 *
 * This is server-source-of-truth and should be used for probe responses.
 */
export function resolveSyncCapability(input: SyncCapabilityInput): SyncCapabilityProbe {
  if (input.backend !== 'sqlite') {
    return {
      mode: 'local-only',
      backend: input.backend,
      reason: 'backend_local_only',
    };
  }

  if (!input.authV1Enabled || !input.workspacesV1Enabled) {
    return {
      mode: 'local-only',
      backend: input.backend,
      reason: 'runtime_features_disabled',
      message: 'Sync runtime features are disabled for this distribution profile.',
    };
  }

  if (input.actorStatus === 409 || input.actorStatus === 503) {
    return {
      mode: 'provisioning-blocked',
      backend: input.backend,
      reason: 'provisioning_blocked',
      message: input.actorError || 'User provisioning is incomplete.',
    };
  }

  return {
    mode: 'db-sync-available',
    backend: input.backend,
    reason: 'runtime_ready',
  };
}

export function parseSyncCapabilityProbe(payload: unknown): SyncCapabilityProbe | null {
  if (!payload || typeof payload !== 'object') return null;

  const candidate = payload as Partial<SyncCapabilityProbe>;
  if (
    (candidate.mode !== 'local-only' &&
      candidate.mode !== 'db-sync-available' &&
      candidate.mode !== 'provisioning-blocked') ||
    (candidate.backend !== 'localStorage' && candidate.backend !== 'sqlite')
  ) {
    return null;
  }

  return {
    mode: candidate.mode,
    backend: candidate.backend,
    message: typeof candidate.message === 'string' ? candidate.message : undefined,
    reason: typeof candidate.reason === 'string' ? candidate.reason : undefined,
  };
}
