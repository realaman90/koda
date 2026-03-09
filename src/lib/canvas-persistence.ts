import type { CanvasMutationKind, CanvasMutationRecord } from '@/stores/canvas-store-helpers';

export interface CanvasPersistencePlan {
  localDelayMs: number | null;
  serverDelayMs: number | null;
  previewEligible: boolean;
}

const PLAN_BY_KIND: Record<CanvasMutationKind, CanvasPersistencePlan> = {
  typing: {
    localDelayMs: null,
    serverDelayMs: null,
    previewEligible: false,
  },
  content: {
    localDelayMs: 1200,
    serverDelayMs: 3000,
    previewEligible: true,
  },
  layout: {
    localDelayMs: 250,
    serverDelayMs: 1500,
    previewEligible: true,
  },
  graph: {
    localDelayMs: 250,
    serverDelayMs: 1500,
    previewEligible: true,
  },
  output: {
    localDelayMs: 250,
    serverDelayMs: 1000,
    previewEligible: true,
  },
  runtime: {
    localDelayMs: null,
    serverDelayMs: null,
    previewEligible: false,
  },
  dragging: {
    localDelayMs: null,
    serverDelayMs: null,
    previewEligible: false,
  },
};

export function resolveCanvasPersistencePlan(
  mutation: Pick<CanvasMutationRecord, 'kind' | 'save' | 'preview'>
): CanvasPersistencePlan {
  const basePlan = PLAN_BY_KIND[mutation.kind];

  return {
    localDelayMs: mutation.save === 'schedule' ? basePlan.localDelayMs : null,
    serverDelayMs: mutation.save === 'schedule' ? basePlan.serverDelayMs : null,
    previewEligible: mutation.preview === 'schedule' && basePlan.previewEligible,
  };
}
