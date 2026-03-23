import { getSandboxProvider } from '@/lib/sandbox/sandbox-factory';
import type { AnimationSkill, RequestContextLike } from './types';

type PendingMedia = {
  id: string;
  name: string;
  data: Buffer;
  destPath: string;
  type?: string;
  source?: string;
};

type SandboxArtifact = {
  success: boolean;
  sandboxId: string;
  status: string;
  previewUrl: string;
  template: 'remotion' | 'theatre';
  message: string;
  uploadedFiles?: string[];
  snapshotRestored?: boolean;
};

const resolveEngine = (inputEngine: unknown, ctx?: RequestContextLike): 'remotion' | 'theatre' => {
  const fromInput = inputEngine === 'theatre' ? 'theatre' : inputEngine === 'remotion' ? 'remotion' : undefined;
  const fromCtx = ctx?.get('engine');
  if (fromInput) return fromInput;
  if (fromCtx === 'theatre') return 'theatre';
  return 'remotion';
};

const resolveSandboxId = (inputSandboxId: unknown, ctx?: RequestContextLike): string | undefined => {
  const fromCtx = ctx?.get('sandboxId');
  if (typeof fromCtx === 'string' && fromCtx) return fromCtx;
  if (typeof inputSandboxId === 'string' && inputSandboxId) return inputSandboxId;
  return undefined;
};

async function uploadPendingMedia(
  sandboxId: string,
  pendingMedia: PendingMedia[],
): Promise<string[]> {
  const uploadedFiles: string[] = [];
  for (const media of pendingMedia) {
    const size = media.data?.length ?? 0;
    if (!size) continue;
    try {
      await getSandboxProvider().writeBinary(sandboxId, media.destPath, media.data);
      uploadedFiles.push(media.destPath);
    } catch (error) {
      console.error(`[sandbox-skill] Failed to upload ${media.name}:`, error);
    }
  }
  return uploadedFiles;
}

async function restoreSnapshotIfPresent(
  sandboxId: string,
  ctx?: RequestContextLike,
): Promise<boolean> {
  const nodeId = ctx?.get('nodeId');
  const phase = ctx?.get('phase');
  const hasPlan = !!ctx?.get('plan');
  const restoreVersionId = ctx?.get('restoreVersionId') as string | undefined;

  if (!nodeId || (phase === 'idle' && !hasPlan && !restoreVersionId)) {
    return false;
  }

  try {
    const { getSnapshotProvider } = await import('@/lib/sandbox/snapshot');
    const exists = await getSnapshotProvider().exists(nodeId as string, restoreVersionId);
    if (!exists) return false;

    const snapshotBuffer = await getSnapshotProvider().load(nodeId as string, restoreVersionId);
    if (!snapshotBuffer) return false;

    return await getSandboxProvider().importSnapshot(sandboxId, snapshotBuffer);
  } catch (error) {
    console.warn(`[sandbox-skill] Snapshot restore failed:`, error);
    return false;
  }
}

function toBlockedArtifact(
  template: 'remotion' | 'theatre',
  message: string,
): SandboxArtifact {
  return {
    success: false,
    sandboxId: '',
    status: 'blocked',
    previewUrl: '',
    template,
    message,
  };
}

export const sandboxSkill: AnimationSkill = {
  id: 'sandbox',
  run: async (input) => {
    const action = input.action || 'preflight_create';
    const ctx = input.requestContext;
    const template = resolveEngine(input.engine ?? input.payload?.template, ctx);

    if (action !== 'create' && action !== 'create_or_reuse') {
      return {
        ok: true,
        summary: 'Sandbox skill preflight passed',
        updates: {
          sandboxId: resolveSandboxId(input.sandboxId, ctx),
        },
      };
    }

    if (ctx?.get('streamClosed')) {
      const artifact = toBlockedArtifact(template, 'Stream closed — sandbox creation skipped.');
      return {
        ok: false,
        retryable: false,
        fatal: false,
        errorClass: 'ValidationError',
        summary: artifact.message,
        artifacts: { sandbox: artifact },
      };
    }

    const existingSandboxId = resolveSandboxId(input.sandboxId, ctx);
    if (existingSandboxId) {
      try {
        const status = await getSandboxProvider().getStatus(existingSandboxId);
        if (status?.status) {
          const artifact: SandboxArtifact = {
            success: true,
            sandboxId: existingSandboxId,
            status: status.status,
            previewUrl: `/api/plugins/animation/sandbox/${existingSandboxId}/proxy`,
            template,
            message: `Sandbox already active: ${existingSandboxId}. Reusing existing sandbox.`,
          };
          return {
            ok: true,
            summary: artifact.message,
            updates: { sandboxId: existingSandboxId },
            artifacts: { sandbox: artifact },
          };
        }
      } catch {
        // Existing sandbox is likely stale; create a new one below.
      }
    }

    const rawProjectId = input.payload?.projectId ?? input.metadata?.projectId ?? 'animation-project';
    const projectId = typeof rawProjectId === 'string' && rawProjectId ? rawProjectId : 'animation-project';

    try {
      const instance = await getSandboxProvider().create(projectId, template);
      ctx?.set('sandboxId', instance.id);

      const pendingMedia = ctx?.get('pendingMedia') as PendingMedia[] | undefined;
      const uploadedFiles = Array.isArray(pendingMedia) && pendingMedia.length > 0
        ? await uploadPendingMedia(instance.id, pendingMedia)
        : [];
      const snapshotRestored = await restoreSnapshotIfPresent(instance.id, ctx);

      const mediaMsg = uploadedFiles.length > 0 ? ` Media auto-uploaded: ${uploadedFiles.join(', ')}` : '';
      const restoreMsg = snapshotRestored ? ' Previous code restored from snapshot.' : '';
      const message = `Sandbox created with ${template} template: ${instance.id}.${mediaMsg}${restoreMsg}`;

      const artifact: SandboxArtifact = {
        success: true,
        sandboxId: instance.id,
        status: instance.status,
        previewUrl: `/api/plugins/animation/sandbox/${instance.id}/proxy`,
        template,
        message,
        uploadedFiles,
        snapshotRestored,
      };

      return {
        ok: true,
        summary: message,
        updates: { sandboxId: instance.id },
        artifacts: { sandbox: artifact },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create sandbox';
      const artifact: SandboxArtifact = {
        success: false,
        sandboxId: '',
        status: 'error',
        previewUrl: '',
        template,
        message,
      };
      return {
        ok: false,
        fatal: false,
        retryable: true,
        errorClass: 'SandboxUnavailableError',
        summary: message,
        artifacts: { sandbox: artifact },
      };
    }
  },
};
